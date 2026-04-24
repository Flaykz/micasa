<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# Service Log Web CRUD (#990)

## Problem

The web UI can manage maintenance items, vendors, and appliances, but it still
cannot record the actual service visits that make maintenance history useful.
Without service logs, the browser surface cannot close the loop between planned
maintenance and completed work.

## Goals

- Add service log detail/create/update/delete flows in the React frontend.
- Show related service logs on maintenance detail pages.
- Keep the Go backend and Bubble Tea TUI behavior unchanged.

## Non-goals

- Restore UI for deleted service logs.
- Document upload from service log screens.
- Inline vendor creation from the service log form.

## API design

- `GET /api/service-logs`
- `GET /api/service-logs/{id}`
- `PUT /api/service-logs/{id}`
- `DELETE /api/service-logs/{id}`
- `GET /api/maintenance/{id}/service-logs`
- `POST /api/maintenance/{id}/service-logs`

Writes should reuse `Store.CreateServiceLog` / `Store.UpdateServiceLog` so the
existing last-serviced sync on maintenance items remains centralized.

## Frontend design

### Routes

- `/service-logs`
- `/service-logs/new`
- `/service-logs/:serviceLogId`
- `/service-logs/:serviceLogId/edit`

### Maintenance detail

Add a related service-log panel on maintenance detail pages. This gives each
maintenance item visible history without requiring a separate drill-down first.

### Form inputs

- maintenance item
- serviced at
- optional vendor
- cost
- notes

## Testing

Write HTTP tests first for:

- service log detail
- service log create
- service log update
- service log delete
- list service logs by maintenance item

Frontend verification continues through TypeScript typecheck, Vite build, and Go
test/build checks.
