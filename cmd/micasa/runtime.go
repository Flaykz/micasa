// Copyright 2026 Phillip Cloud
// Licensed under the Apache License, Version 2.0

package main

import (
	"fmt"
	"os"

	"charm.land/lipgloss/v2"
	"github.com/micasa-dev/micasa/internal/config"
	"github.com/micasa-dev/micasa/internal/data"
)

type runtimeEnv struct {
	store *data.Store
	cfg   config.Config
}

func openRuntime(dbPath string, seed *seedOpts) (*runtimeEnv, error) {
	store, err := data.Open(dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := store.AutoMigrate(); err != nil {
		_ = store.Close()
		return nil, fmt.Errorf("migrate database: %w", err)
	}
	if err := store.SeedDefaults(); err != nil {
		_ = store.Close()
		return nil, fmt.Errorf("seed defaults: %w", err)
	}
	if err := seedStore(store, seed); err != nil {
		_ = store.Close()
		return nil, err
	}

	cfg, err := config.Load()
	if err != nil {
		_ = store.Close()
		return nil, fmt.Errorf("load config: %w", err)
	}
	if err := store.SetMaxDocumentSize(cfg.Documents.MaxFileSize.Bytes()); err != nil {
		_ = store.Close()
		return nil, fmt.Errorf("configure document size limit: %w", err)
	}
	cacheDir, err := data.DocumentCacheDir()
	if err != nil {
		_ = store.Close()
		return nil, fmt.Errorf("resolve document cache directory: %w", err)
	}
	if _, err := data.EvictStaleCache(cacheDir, cfg.Documents.CacheTTLDuration()); err != nil {
		_ = store.Close()
		return nil, fmt.Errorf("evict stale cache: %w", err)
	}
	if err := store.ResolveCurrency(cfg.Locale.Currency); err != nil {
		_ = store.Close()
		return nil, fmt.Errorf("resolve currency: %w", err)
	}

	return &runtimeEnv{store: store, cfg: cfg}, nil
}

func (r *runtimeEnv) Close() error {
	if r == nil || r.store == nil {
		return nil
	}
	return r.store.Close()
}

func emitConfigWarnings(cfg config.Config) {
	if len(cfg.Warnings) == 0 {
		return
	}
	isDark := lipgloss.HasDarkBackground(os.Stdin, os.Stderr)
	warnColor := "#F0E442"
	if !isDark {
		warnColor = "#B8860B"
	}
	warnStyle := lipgloss.NewStyle().Foreground(lipgloss.Color(warnColor))
	for _, warning := range cfg.Warnings {
		fmt.Fprintln(os.Stderr, warnStyle.Render("warning:")+" "+warning)
	}
}
