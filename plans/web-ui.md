<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# Web UI (#444)

## Problem

`micasa` already has a strong Go data layer and a mature Bubble Tea TUI, but it
does not offer a browser interface. Users who do not want to live in a terminal
have no first-party way to use the app.

At the same time, the TUI is a core part of the project and must remain intact.
The web work must be additive so syncing changes from `micasa-dev/micasa`
stays straightforward.

## Goals

- Keep the existing `micasa` TUI behavior unchanged.
- Add a browser UI without splitting the data layer into a separate repo.
- Reuse the existing Go store and config code.
- Keep the first slice small enough to land safely and iterate on.

## Non-goals for the first slice

- Full parity with the TUI.
- A separate frontend build toolchain.
- Replacing existing CLI/TUI entrypoints.
- Authentication, multi-user sessions, or internet-facing deployment hardening.

## Design

### Entry point

Add a new `web` subcommand to `cmd/micasa` instead of a new top-level binary.

Why:

- Keeps distribution simple: one binary, two interfaces.
- Preserves the current default behavior (`micasa` still launches the TUI).
- Minimizes churn in module/package layout.

Proposed CLI shape:

```sh
micasa web
micasa web --addr :8080
micasa web --demo
```

### Shared startup

The TUI and web server need the same bootstrapping steps:

1. Resolve DB path.
2. Open store.
3. Run `AutoMigrate()`.
4. Run `SeedDefaults()`.
5. Optionally seed demo data.
6. Load config.
7. Apply document-size and currency configuration.

This shared startup should be extracted into a small helper instead of
duplicating the TUI setup logic.

### Server package

Add a new internal package for the browser surface, e.g. `internal/web`.

Responsibilities:

- Build an `http.Handler` with JSON API routes.
- Serve embedded static assets at `/`.
- Keep handlers thin and call `internal/data` directly.

The server should not know about Bubble Tea types.

### API scope: first slice

Start with read-only routes backing a useful dashboard and list views:

- `GET /api/house`
- `GET /api/dashboard`
- `GET /api/project-types`
- `GET /api/maintenance-categories`
- `GET /api/projects`
- `GET /api/quotes`
- `GET /api/vendors`
- `GET /api/maintenance`
- `GET /api/appliances`
- `GET /api/incidents`
- `GET /api/documents`

Why read-only first:

- Delivers a real browser surface without forcing immediate parity on every
  TUI mutation path.
- Keeps the first reviewable change bounded.
- Lets us harden the transport and response shapes before adding writes.

### Response shape

Prefer returning existing data models where their JSON shape is already stable.
Add small response wrappers only when aggregation or field trimming is needed.

Rules:

- Every response field must use explicit `json:"snake_case"` tags.
- Document list responses must avoid shipping large BLOB data.
- Dashboard should aggregate existing store methods rather than duplicating SQL.

### Frontend

Use a build-free static frontend embedded with `go:embed`.

Initial structure:

- `internal/web/static/index.html`
- `internal/web/static/app.css`
- `internal/web/static/app.js`

The first UI should be intentionally simple but not generic boilerplate:

- a dense home-management dashboard
- list navigation for key entities
- responsive layout that works on desktop and mobile
- no dependency on npm, node, or a bundler

### Testing

Write tests first for the first browser slice.

Coverage for the first implementation should include:

- `micasa web --help` exposes the new entrypoint.
- `GET /` serves the embedded app shell.
- `GET /api/dashboard` returns expected sections against demo data.
- representative list endpoints (`/api/projects`, `/api/vendors`, etc.) return
  JSON successfully from a real SQLite-backed store.

Use `httptest` and real store setup. Treat HTTP requests as the user-level
interaction for this browser surface.

## Rollout plan

### Phase 1

- Add `web` subcommand.
- Extract shared startup helper.
- Add read-only API.
- Add embedded static dashboard UI.

### Phase 2

- Add detail views and drill-down navigation.
- Add create/update/delete flows.
- Add file upload/download flows for documents.

### Phase 3

- Decide whether the TUI and web should share more response/view-model helpers.
- Revisit whether a standalone `micasa-web` binary adds meaningful value.
