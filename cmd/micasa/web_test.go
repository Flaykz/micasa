// Copyright 2026 Phillip Cloud
// Licensed under the Apache License, Version 2.0

package main

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWebCommandHelp(t *testing.T) {
	t.Parallel()

	out, err := executeCLI("web", "--help")
	require.NoError(t, err)

	assert.Contains(t, out, "Run the browser UI")
	assert.Contains(t, out, "--addr")
	assert.Contains(t, out, "--demo")
	assert.Contains(t, strings.ToLower(out), "web")
}
