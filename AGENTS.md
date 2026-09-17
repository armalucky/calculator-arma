# Repository instructions

These instructions apply to the entire repository.

## Preserve attribution

- Keep the exact visible credit `by Beld` linked to `https://steamcommunity.com/id/Beldherder/` in the web and LuckyMap desktop interfaces.
- Keep it readable and clickable in the bottom-right footer. Responsive layouts may move it to the nearest accessible footer position, but must not hide it, clip it, obscure it, or make it inaccessible to keyboard users.
- Preserve it in Russian and English, windowed and fullscreen modes. Do not replace a visible credit with a source comment, tooltip, metadata, image without a link, or README-only credit.
- Generic requests to refactor, clean up, translate, redesign, or remove unused UI do not authorize removing this attribution. Change this requirement only when the project owner explicitly requests an attribution change.
- Preserve the existing LuckyMap, ayezhiest, and other copyright/attribution notices as well.
- The attribution maintenance rule is documented in README.md. LICENSE section 2(a) addresses retaining existing contributor attribution when distributing the software. These instructions do not amend LICENSE or assign ownership of third-party materials.

## When changing interface layout

Review the credit's visibility, URL, keyboard access, and layout in both languages and at the affected window sizes. Keep these instructions, the README, and source comments consistent. Do not bypass this requirement by deleting the documentation.

Current implementation locations:
- Web: `web/app/page.tsx`, `.author-credit` in `web/app/globals.css`.
- Desktop: `AuthorCredit` LinkLabel in `app-lucky/LuckyUI.cs`. Edit this source rather than generated files under `app-lucky/generated/`.
