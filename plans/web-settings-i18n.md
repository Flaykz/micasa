<!-- Copyright 2026 Phillip Cloud -->
<!-- Licensed under the Apache License, Version 2.0 -->

# Web Settings + Language Selection (#3)

## Problem

The React web frontend currently has no Settings page and no way to choose the
display language. Dates and number formatting partly follow browser defaults,
but the interface copy itself is hard-coded in English.

## Goals

- Add a browser-accessible Settings page.
- Add language selection with at least English and French.
- Persist the selected language locally in the browser.
- Apply the selected language to the main web shell and high-traffic screens.

## Non-goals

- A backend settings API.
- Full localization of every last dynamic label in one change.
- Translating user-generated content.

## Design

### Architecture

- Add a small frontend-only i18n layer in `web/src/i18n.tsx`.
- Expose `language`, `setLanguage`, and `t()` via React context.
- Persist the chosen language in `localStorage`.
- Fall back to the browser language on first load.

### Scope for first translation pass

- app shell / masthead
- navigation labels
- page headers
- common buttons and empty states
- key dashboard labels
- Settings page copy

### Formatting

- Dates should use the selected language locale instead of raw browser default.
- Currency formatting should keep using the server-provided currency code, but
  render through the selected frontend locale.

## Testing

- Add frontend interaction tests with Vitest + Testing Library.
- Cover:
  - Settings route renders
  - language can be switched to French
  - navigation/shell text updates after the switch

## Verification

- `pnpm exec vitest run`
- `pnpm exec tsc --noEmit`
- `pnpm build`
- existing Go tests/build remain green
