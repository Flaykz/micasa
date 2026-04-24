<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# House + Project Web CRUD (#983)

## Problem

The React frontend now serves a real browser UI, but it is still read-only. The
most useful next step is to make the house profile editable and to add the first
real CRUD workflow for a multi-row entity.

Projects are the best first candidate because they are central to the app,
already have list/detail semantics, and exercise create, update, and delete
without dragging in file upload or nested child records.

## Goals

- Add house profile detail/editing in the web UI.
- Add project detail, create, update, and delete flows in the web UI.
- Keep the Go backend and TUI behavior unchanged.
- Keep the API and frontend additions isolated for easy upstream sync.

## Non-goals

- Quotes, vendors, maintenance, or document CRUD in this tranche.
- Restore UI for soft-deleted projects.
- Frontend state libraries beyond local React state.

## API design

### House

- `GET /api/house`
- `PUT /api/house`

`PUT /api/house` should auto-create the singleton if it does not exist yet,
then return the stored profile.

### Projects

- `GET /api/projects`
- `GET /api/projects/{id}`
- `POST /api/projects`
- `PUT /api/projects/{id}`
- `DELETE /api/projects/{id}`

Project create/update bodies will use the existing `data.Project` JSON shape.
That keeps the API thin and aligned with the current data model.

## Frontend design

### House route

Add `/house` with two states:

- read-only summary card
- edit form that either creates or updates the singleton

The dashboard house card should link into this route.

### Projects routes

- `/projects`
- `/projects/new`
- `/projects/:projectId`
- `/projects/:projectId/edit`

The projects list should gain clear navigation affordances to the detail view
and to the create form.

The detail page should show the core project fields and actions to edit/delete.

## Testing

Write HTTP tests first for:

- `PUT /api/house` create path
- `PUT /api/house` update path
- `GET /api/projects/{id}` success path
- `POST /api/projects` create path
- `PUT /api/projects/{id}` update path
- `DELETE /api/projects/{id}` delete path

Frontend behavior in this tranche is verified by building the React app and
exercising the API-backed Go tests. The browser routes continue to be covered by
the existing SPA shell tests.
