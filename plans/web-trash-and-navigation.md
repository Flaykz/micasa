<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# Web Trash + Navigation Polish (#991)

## Problem

The browser UI now covers most of the day-to-day entities, but two gaps remain:

- soft-deleted rows can only be restored through backend/TUI paths
- navigation between related records is still more isolated than it should be

Users need a first-class web way to recover deleted data, and the detail pages
should make it easier to move between linked records.

## Goals

- Add a browser-accessible trash page listing unrestored soft-deletes.
- Add restore actions from the browser for all supported entity types.
- Improve navigation with a small set of high-value cross-links and a dedicated
  trash destination in the primary nav.
- Keep the Go backend and Bubble Tea TUI unchanged.

## Non-goals

- Per-list "show deleted" toggles everywhere.
- Bulk restore.
- Hard-delete from the browser.

## API design

- `GET /api/trash`
- `POST /api/trash/{entity}/{id}/restore`

`GET /api/trash` should return unrestored deletion records enriched with a human
label for the deleted row.

Supported restore entity types:

- `project`
- `quote`
- `vendor`
- `maintenance`
- `appliance`
- `service_log`
- `document`
- `incident`

## Frontend design

### Trash page

- route: `/trash`
- primary-nav entry: `Trash`
- cards listing deleted items with entity type, label, deleted time, and a
  restore action

### Navigation polish

Add targeted cross-links where the relationships already exist and users are
most likely to want to hop across records:

- document detail -> linked record
- quote detail -> project and vendor
- incident detail -> appliance and vendor
- service log detail -> maintenance item and vendor

This keeps the polish focused and avoids a noisy network of buttons on every
screen.

## Testing

Write HTTP tests first for:

- trash listing after a soft-delete
- restore action from trash back to an active row

Frontend verification continues through TypeScript typecheck, Vite build, and Go
test/build checks.
