// Copyright 2026 Phillip Cloud
// Licensed under the Apache License, Version 2.0

package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/micasa-dev/micasa/internal/data"
	webui "github.com/micasa-dev/micasa/internal/web"
	"github.com/spf13/cobra"
)

type webOpts struct {
	addr   string
	dbPath string
	demo   bool
}

func newWebCmd() *cobra.Command {
	opts := &webOpts{}

	cmd := &cobra.Command{
		Use:           "web [database-path]",
		Short:         "Run the browser UI",
		Long:          "Run the browser UI and JSON API without replacing the terminal UI.",
		Args:          cobra.MaximumNArgs(1),
		SilenceErrors: true,
		SilenceUsage:  true,
		RunE: func(cmd *cobra.Command, args []string) error {
			if len(args) > 0 {
				opts.dbPath = args[0]
			}
			return runWeb(cmd.Context(), opts)
		},
	}

	cmd.Flags().StringVar(&opts.addr, "addr", ":8080", "Listen address for the web UI")
	cmd.Flags().BoolVar(&opts.demo, "demo", false, "Seed demo data into an in-memory database when no path is provided")

	return cmd
}

func (opts *webOpts) resolveDBPath() (string, error) {
	if opts.dbPath != "" {
		return data.ExpandHome(opts.dbPath), nil
	}
	if opts.demo {
		return ":memory:", nil
	}
	return data.DefaultDBPath()
}

func runWeb(parent context.Context, opts *webOpts) error {
	dbPath, err := opts.resolveDBPath()
	if err != nil {
		return fmt.Errorf("resolve db path: %w", err)
	}

	var seed *seedOpts
	if opts.demo {
		seed = &seedOpts{}
	}

	runtime, err := openRuntime(dbPath, seed)
	if err != nil {
		return err
	}
	defer func() { _ = runtime.Close() }()

	emitConfigWarnings(runtime.cfg)

	server := &http.Server{
		Addr:              opts.addr,
		Handler:           webui.NewServer(runtime.store),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(parent, os.Interrupt, syscall.SIGTERM)
	defer stop()

	serveErr := make(chan error, 1)
	go func() {
		err := server.ListenAndServe()
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			serveErr <- fmt.Errorf("listen: %w", err)
			return
		}
		serveErr <- nil
	}()

	displayAddr := opts.addr
	if strings.HasPrefix(displayAddr, ":") {
		displayAddr = "localhost" + displayAddr
	}
	fmt.Fprintf(os.Stderr, "micasa web: listening on http://%s\n", displayAddr)
	if dbPath == ":memory:" {
		fmt.Fprintln(os.Stderr, "micasa web: using in-memory demo database")
	} else {
		fmt.Fprintf(os.Stderr, "micasa web: database at %s\n", dbPath)
	}

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}

	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}

	return <-serveErr
}
