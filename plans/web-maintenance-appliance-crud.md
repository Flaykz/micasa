<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# Maintenance + Appliance Web CRUD (#985)

## Problem

After projects, vendors, and quotes, the next missing browser workflows are the
core home-maintenance records themselves: appliances and maintenance items.
Without them, the web UI still cannot manage the inventory and recurring work
that make up most day-to-day usage.

## Goals

- Add appliance detail/create/update/delete flows in the React frontend.
- Add maintenance item detail/create/update/delete flows in the React frontend.
- Show related maintenance items on appliance detail pages.
- Keep the Go backend and Bubble Tea TUI unchanged.

## Non-goals

- Service log CRUD in this tranche.
- Inline appliance creation from the maintenance form.
- Restore UI for appliances or maintenance items.

## API design

### Appliances

- `GET /api/appliances`
- `GET /api/appliances/{id}`
- `GET /api/appliances/{id}/maintenance`
- `POST /api/appliances`
- `PUT /api/appliances/{id}`
- `DELETE /api/appliances/{id}`

### Maintenance items

- `GET /api/maintenance`
- `GET /api/maintenance/{id}`
- `POST /api/maintenance`
- `PUT /api/maintenance/{id}`
- `DELETE /api/maintenance/{id}`

### Reference data used by forms

- `GET /api/maintenance-categories`
- `GET /api/appliances`

The maintenance form will select an existing category and an optional appliance.

## Frontend design

### Appliance routes

- `/appliances`
- `/appliances/new`
- `/appliances/:applianceId`
- `/appliances/:applianceId/edit`

### Maintenance routes

- `/maintenance`
- `/maintenance/new`
- `/maintenance/:maintenanceId`
- `/maintenance/:maintenanceId/edit`

### Appliance detail

Add a related-maintenance panel fed by `/api/appliances/{id}/maintenance` so the
browser UI exposes the relationship between tracked equipment and scheduled
work.

## Testing

Write HTTP tests first for:

- appliance detail/create/update/delete
- maintenance detail/create/update/delete
- list maintenance by appliance

Frontend verification continues through TypeScript typecheck, Vite build, and Go
test/build checks.
