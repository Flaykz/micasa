<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# React Web Frontend (#982)

## Problem

The initial browser UI works, but it is a hand-written static app. The next web
tranches will need denser CRUD flows, entity detail screens, routing, and form
state. Vanilla JS will get harder to maintain as the surface grows.

At the same time, `micasa` must keep its Go backend and Bubble Tea TUI intact so
syncing from `micasa-dev/micasa` remains straightforward.

## Goals

- Adopt React for the browser frontend.
- Keep the Go API and TUI unchanged in behavior.
- Build static assets and serve them from the Go web server.
- Keep the frontend isolated so upstream sync friction stays low.

## Non-goals

- Replacing the Go web server with a Node runtime.
- Moving core domain logic out of `internal/data`.
- Full CRUD parity in the same change.

## Design

### Frontend stack

- React
- TypeScript
- Vite

Why:

- Strong ecosystem for data-heavy CRUD UI.
- Fast local iteration.
- Straightforward static build output for `go:embed`.

### Layout

- `web/` contains React source, TypeScript config, and Vite config.
- Vite builds to `internal/web/dist/`.
- `internal/web/server.go` embeds `dist/` and serves it as the browser app.

This keeps the frontend isolated from the TUI and from the data layer.

### Server behavior

- `/api/*` continues serving JSON from Go handlers.
- Static asset requests under `/assets/*` serve the compiled frontend files.
- Browser routes like `/projects` or `/vendors/123` fall back to `index.html`
  so React Router can handle navigation client-side.

### UI scope for this tranche

Port the current read-only dashboard/list experience into React:

- dashboard summaries
- house profile overview
- project, maintenance, appliance, vendor, and incident sections

No CRUD in this tranche. React is the foundation for the next slices.

## Testing

Add tests before implementation for the routing behavior the static file server
does not currently support:

- `GET /` serves the React app shell
- `GET /projects` also serves the app shell (SPA fallback)
- existing JSON API tests continue to pass

## Follow-up slices

1. Add React Router screens for list/detail navigation.
2. Add TanStack Query for data loading/mutations.
3. Add first write flows: house profile, then projects.
