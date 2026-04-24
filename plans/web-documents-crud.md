<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# Document Web CRUD (#989)

## Problem

The browser UI can list documents, but it cannot yet upload files, inspect a
document record in detail, download the underlying file, or update document
metadata. That leaves one of the most practical parts of the app incomplete.

## Goals

- Add document detail, upload, metadata edit, delete, and binary download flows
  in the React frontend.
- Keep the Go backend and Bubble Tea TUI behavior unchanged.
- Reuse the existing `internal/data` document validation and storage logic.

## Non-goals

- Restore UI for deleted documents.
- OCR/extraction controls in the browser.
- Drag-and-drop multi-file upload.

## API design

- `GET /api/documents`
- `GET /api/documents/{id}`
- `GET /api/documents/{id}/download`
- `POST /api/documents`
- `PUT /api/documents/{id}`
- `DELETE /api/documents/{id}`

`POST /api/documents` uses multipart form upload with:

- `file` (required)
- `title` (optional)
- `entityKind` (optional)
- `entityId` (optional)
- `notes` (optional)

The Go server should continue using `Store.CreateDocument` so size checks and
existing metadata rules stay centralized.

## Frontend design

### Routes

- `/documents`
- `/documents/new`
- `/documents/:documentId`
- `/documents/:documentId/edit`

### Upload form

The upload screen should let the user choose:

- the file
- optional title override
- optional related entity kind
- optional related entity instance
- notes

Entity selection should be driven from existing browser data already exposed by
the app: projects, vendors, quotes, appliances, maintenance items, and
incidents.

### Detail screen

Show metadata plus a direct download action.

## Testing

Write HTTP tests first for:

- document detail
- multipart upload
- binary download
- metadata update
- delete

Frontend verification continues through TypeScript typecheck, Vite build, and Go
test/build checks.
