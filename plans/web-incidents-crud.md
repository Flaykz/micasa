<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# Incident Web CRUD (#988)

## Problem

The web UI can already list incidents, but it still cannot inspect a single
incident or manage the lifecycle of a problem from the browser. That leaves a
meaningful gap in the maintenance workflow because incidents are one of the most
time-sensitive records in the product.

## Goals

- Add incident detail/create/update/delete flows in the React frontend.
- Keep the Go backend and Bubble Tea TUI behavior unchanged.
- Reuse existing appliances and vendors as optional relations in the incident
  form.

## Non-goals

- Restore UI for incidents.
- Document upload from the incident screen.
- Additional automation around incident status transitions beyond the current
  store behavior.

## API design

- `GET /api/incidents`
- `GET /api/incidents/{id}`
- `POST /api/incidents`
- `PUT /api/incidents/{id}`
- `DELETE /api/incidents/{id}`

The delete path keeps the existing store semantics: it soft-deletes the row and
marks the incident resolved as part of the delete transaction.

## Frontend design

### Routes

- `/incidents`
- `/incidents/new`
- `/incidents/:incidentId`
- `/incidents/:incidentId/edit`

### Form inputs

- title
- description
- status
- severity
- date noticed
- date resolved
- location
- cost
- optional appliance
- optional vendor
- notes

## Testing

Write HTTP tests first for:

- incident detail
- incident create
- incident update
- incident delete

Frontend verification continues through TypeScript typecheck, Vite build, and Go
test/build checks.
