<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# Vendor + Quote Web CRUD (#984)

## Problem

After `house` and `projects`, the next missing browser workflows are vendors and
quotes. Quotes are especially important because they are directly tied to
projects; without them, project detail pages are still incomplete.

## Goals

- Add vendor detail/create/update/delete flows in the React frontend.
- Add quote detail/create/update/delete flows in the React frontend.
- Show related quotes on project detail pages.
- Keep the Go backend and TUI behavior unchanged.

## Non-goals

- Restore UI for vendors or quotes.
- Inline vendor creation inside the quote form.
- Service log or maintenance CRUD in this tranche.

## API design

### Vendors

- `GET /api/vendors`
- `GET /api/vendors/{id}`
- `POST /api/vendors`
- `PUT /api/vendors/{id}`
- `DELETE /api/vendors/{id}`

### Quotes

- `GET /api/quotes`
- `GET /api/quotes/{id}`
- `GET /api/projects/{id}/quotes`
- `POST /api/quotes`
- `PUT /api/quotes/{id}`
- `DELETE /api/quotes/{id}`

Quote writes will bind to an existing vendor selected in the UI. The server can
load that vendor by ID and reuse the existing `Store.CreateQuote` /
`Store.UpdateQuote` APIs instead of changing the data layer contract.

## Frontend design

### Vendor routes

- `/vendors`
- `/vendors/new`
- `/vendors/:vendorId`
- `/vendors/:vendorId/edit`

### Quote routes

- `/quotes`
- `/quotes/new`
- `/quotes/:quoteId`
- `/quotes/:quoteId/edit`

### Project detail

Add a secondary panel listing quotes returned by `/api/projects/{id}/quotes`.
This gives projects a meaningful relationship view without yet expanding into
full nested editing from the same screen.

## Testing

Write HTTP tests first for:

- vendor detail/create/update/delete
- quote detail/create/update/delete
- list quotes by project

Frontend verification continues through TypeScript build + Vite build + Go test
and build checks.
