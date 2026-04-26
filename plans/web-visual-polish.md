<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# Web Visual Polish (#992)

## Problem

The React web frontend is now functionally broad, but its visual treatment is
still mostly a solid CRUD shell. The underlying palette and typography are good,
yet the UI needs a more intentional layout, stronger hierarchy, and better
visual rhythm so it feels like a product rather than a pile of forms.

## Goals

- Improve the overall visual identity without changing the Go backend.
- Make navigation, dashboard, detail screens, forms, and the trash page feel
  like one coherent surface.
- Preserve responsiveness on desktop and mobile.

## Non-goals

- A frontend framework change.
- New backend data just for presentation.
- Animation-heavy interactions or decorative-only flourishes that hurt clarity.

## Design direction

- Treat the app more like a field notebook/control room than a generic admin.
- Introduce a stronger shell with a distinct nav rail/card treatment.
- Give page headers, actions, and detail panels clearer visual hierarchy.
- Make cards and forms feel more tactile and polished.

## Scope

- App shell and navigation
- Dashboard composition and cards
- Page headers and action bars
- Detail panels and record cards
- Forms and empty/error states
- Trash page styling

## Verification

- TypeScript typecheck
- Vite production build
- Existing Go web tests/build remain green
