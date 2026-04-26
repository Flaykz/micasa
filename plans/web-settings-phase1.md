<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# Web Settings Phase 1

## Problem

The web frontend now has a basic Settings screen with language selection, but it
still lacks useful application settings beyond that single browser preference.
At the same time, the repo already has two configuration surfaces with different
semantics:

- shared preferences persisted in SQLite (`internal/data/settings.go`)
- system configuration loaded from `config.toml` (`internal/config/config.go`)

We need to expose useful settings in the browser without blurring those two
surfaces or making the web UI responsible for editing sensitive config too soon.

## Goals

- Add a first-class settings API for shared app settings.
- Extend the web Settings page with:
  - shared app settings (SQLite-backed)
  - local browser preferences
  - readonly system config summary
- Apply selected browser preferences immediately in the UI.

## Non-goals

- Editing `config.toml` from the browser.
- Managing API keys or other secrets in the web UI.
- Full parity with every possible TUI-only preference.

## Design

### Backend API

- `GET /api/settings`
- `PUT /api/settings`

`GET /api/settings` returns:

- `shared`
  - `currency`
  - `unit_system`
- `system`
  - readonly summary from resolved config

`PUT /api/settings` updates only the `shared` subset.

### Shared settings

These are persisted in SQLite and safe to expose first:

- `currency`
- `unit_system`

Why these first:

- they already exist in `internal/data/settings.go`
- they are not secret
- they are meaningful to both web and TUI callers

### Web-only settings

Stored locally in the browser via `localStorage`:

- `language`
- `default_route`
- `confirm_destructive_actions`
- `density`

Why local:

- they are presentation concerns rather than shared application state
- they should not unexpectedly change the experience on another machine/device

### System config summary

Readonly section populated from `config.Load()`:

- address autofill
- documents max file size
- documents cache TTL
- chat provider/model/base URL/timeout
- extraction max pages
- extraction OCR enabled
- extraction LLM enabled

This gives the web UI visibility into effective config without taking on TOML
mutation or secret handling in phase 1.

### Immediate UI behavior

- `default_route` changes what `/` resolves to in the browser
- `confirm_destructive_actions` controls delete confirmations in the web UI
- `density` changes the content shell class and spacing
- `unit_system` affects web area display where applicable

## Testing

Write API tests first for `GET /api/settings` and `PUT /api/settings`.

Frontend verification uses:

- Vitest for interaction coverage where helpful
- TypeScript typecheck
- Vite production build
- existing Go tests/build
