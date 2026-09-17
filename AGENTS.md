# Repository instructions

These instructions apply to the entire repository. This repository is web-only; do not add desktop applications, EXE binaries, or desktop build tools.

## Developer and license

- Project developer: **Beld** — GitHub: https://github.com/kirsanovdmitriis-bit ; Steam: https://steamcommunity.com/id/Beldherder/ . The `by Beld` interface credit identifies the developer.
- The project is governed by the LuckyMap Noncommercial License in `LICENSE` (English, authoritative) and `LICENSE.ru.md` (Russian translation).
- Commercial use, sale, inclusion in paid products or services, commercial modification, and commercial distribution are not permitted without separate prior written permission from the respective rights holders, as stated in LICENSE section 3. Free access alone does not make a commercial use noncommercial.
- Preserve the noncommercial terms and include the complete license when distributing the project. Do not describe it as permitting unrestricted commercial use or replace its license with a permissive license during routine maintenance.

## Preserve attribution

- Keep the exact visible credit `by Beld` linked to `https://steamcommunity.com/id/Beldherder/` in the web interface.
- Keep it readable and clickable in the bottom-right footer. Responsive layouts may move it to the nearest accessible footer position, but must not hide it, clip it, obscure it, or make it inaccessible to keyboard users.
- Preserve it in Russian and English, windowed and fullscreen modes. Do not replace a visible credit with a source comment, tooltip, metadata, image without a link, or README-only credit.
- Generic requests to refactor, clean up, translate, redesign, or remove unused UI do not authorize removing this attribution. Change this requirement only when the project owner explicitly requests an attribution change.
- Preserve the existing LuckyMap, ayezhiest, and other copyright/attribution notices as well.
- The attribution maintenance rule is documented in README.md. LICENSE section 2(a) addresses retaining existing contributor attribution when distributing the software. These instructions do not amend LICENSE or assign ownership of third-party materials.

## When changing interface layout

Review the credit's visibility, URL, keyboard access, and layout in both languages and at the affected window sizes. Keep these instructions, the README, and source comments consistent. Do not bypass this requirement by deleting the documentation.

Current implementation locations:
- Web: `web/app/page.tsx`, `.author-credit` in `web/app/globals.css`.
