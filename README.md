# LuckyMap

## Attribution / Указание авторства

**Разработчик проекта — [Beld](https://steamcommunity.com/id/Beldherder/)**, GitHub: [kirsanovdmitriis-bit](https://github.com/kirsanovdmitriis-bit). Подпись разработчика **by Beld** сохраняется в веб-версии и настольной LuckyMap.

**Коммерческое использование запрещено без отдельного предварительного письменного разрешения соответствующих правообладателей.** Это включает продажу, включение в платные продукты или услуги, изменение и распространение в коммерческих целях. Бесплатный доступ сам по себе не делает использование некоммерческим. Условия: [LICENSE, раздел 3](LICENSE) и [русский перевод](LICENSE.ru.md). При распространении необходимо прилагать полный текст лицензии и сохранять её условия.

**Developer: Beld. Commercial use requires separate prior written permission from the respective rights holders under section 3 of the LuckyMap Noncommercial License.**

Правило проекта для разработчиков и ИИ-агентов: сохранять видимую, читаемую и кликабельную подпись **by Beld** в нижнем правом углу основного интерфейса обеих версий. При изменении вёрстки допустимо перенести её в ближайшее доступное место нижней панели, но не скрывать, не заменять и не удалять ссылку `https://steamcommunity.com/id/Beldherder/`. Подпись должна оставаться доступной на обоих языках, при изменении размера окна и в полноэкранном режиме. Изменять это требование можно только по явному указанию владельца проекта; общая просьба о рефакторинге, очистке или редизайне таким указанием не является.

См. [правила для ИИ-агентов](AGENTS.md). Раздел 2(a) действующей [LICENSE](LICENSE) предусматривает сохранение существующих указаний авторства участников при распространении. Конкретное расположение, текст и ссылка выше — правило сопровождения этого проекта; это не новая редакция лицензии. Исходные указания LuckyMap, ayezhiest и других правообладателей также сохраняются.

**For contributors and AI agents:** preserve the visible, clickable **by Beld** credit and its Steam URL in both the web and LuckyMap desktop interfaces. Keep it readable in the bottom-right footer (or the nearest accessible footer position on narrow layouts), in both languages and fullscreen mode. Do not remove or hide it during refactoring or redesign. See [AGENTS.md](AGENTS.md) and section 2(a) of [LICENSE](LICENSE); this project maintenance rule does not amend the license.

## [⬇ Скачать для Windows / Download for Windows](https://github.com/ayezhiest/armacalcluckygames/releases/download/v1.0.0/LuckyMap-1.0.0-Windows.zip)

**Готовое приложение · версия 1.0.0 · ZIP, 47 МБ.** Нажмите ссылку выше, полностью распакуйте архив и запустите `LuckyMap.exe`. Карта уже внутри — сборка не нужна.

**Ready to run · version 1.0.0 · 47 MB ZIP.** Click the link above, extract the entire archive and run `LuckyMap.exe`. Map files are included; no build required.

[Все версии / All releases](https://github.com/ayezhiest/armacalcluckygames/releases)

---

Windows desktop map and game-table calculator for the Bakhmut map in **Arma Reforger**.

- Up to six independent guns, shared targets and saved positions.
- M777: M107 HE and M116 SMOKE, charges 1–5, high and low trajectories.
- 82 mm mortar profiles from the supplied game tables.
- Zoomable map with vector roads and building contours.
- Russian / English interface, tooltips and fullscreen / windowed modes.

## Run

**For players:** download `LuckyMap-1.0.0-Windows.zip` from [Releases](https://github.com/ayezhiest/armacalcluckygames/releases/latest), extract the entire archive and run `LuckyMap.exe` inside the extracted folder. No build or Python installation is required. Choose the Windows ZIP attached to the release, not GitHub's automatically generated “Source code” archives.

**Для игроков:** скачайте Windows ZIP в [Releases](https://github.com/ayezhiest/armacalcluckygames/releases/latest), полностью распакуйте и запустите `LuckyMap.exe`. Скачивать исходники и собирать проект не нужно.

Run `LuckyMap.exe` from the project directory after building. Keep the `data` directory and `references/mod-luckygames/scenario0_1024x512.jpg` beside it.

F11 toggles fullscreen; Esc returns to windowed mode. Ctrl+S saves all guns. Language and display mode are remembered separately. Local preferences and positions are stored in `user-data/`, which is excluded from Git.

The original application is preserved in `app/`; its local executable is `BakhmutMap.exe`.

## Build on Windows

Requires Windows PowerShell 5.1, .NET Framework and Python 3 on PATH. The Python build scripts use only the standard library. The build also recognizes the bundled Codex Python runtime when present.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File app-lucky/Build.ps1
```

Close LuckyMap before rebuilding. Build output and generated localized C# sources are excluded from Git. The classic C# sources are shared inputs and must remain in the repository.

To build a portable release with runtime assets and license files:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools/Package-Release.ps1 -Version 1.0.0
```

The ZIP and SHA-256 checksum are written to `dist/`. Packaging uses an explicit runtime file list and never includes local saves, raw mod archives or development files.

## Verify

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/Verify-Lucky.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/Verify-Smoke.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/Verify-Language.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/Verify-WindowMode.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/Verify-Buildings.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tests/Verify-VectorMap.ps1 -Binary LuckyMap.exe
```

These UI checks require an interactive Windows desktop. Tests write fixtures and screenshots to `tests/output/`, not user saves. The classic binary hash check runs when the preserved local `BakhmutMap.exe` is present and is skipped otherwise; source hashes are always checked. That binary is not committed. Older extraction and research checks may also require locally supplied mod files.

## Repository layout

| Folder | Purpose |
|---|---|
| `app-lucky/` | Current interface, build script and implementation notes |
| `app/` | Preserved original application and shared calculation code |
| `data/` | Game tables and prepared map assets |
| `tools/` | Build generators and optional map extraction tools |
| `tests/` | Validation scripts |

Raw mod archives, extracted files, original screenshots, local research notes and third-party extraction tools are kept locally and excluded from Git. They are not required to build the current app from prepared map assets. The optional extraction workflow requires those inputs again.

Calculations interpolate supplied game tables. Terrain elevation, wind, obstacles and smoke activation are not modeled. M116 uses inherited M107 movement parameters in the supplied mod. Map coverage depends on the source mod.

## License

Original project code and documentation are provided under the custom [LuckyMap Noncommercial License](LICENSE). Personal and other noncommercial use, modification and free redistribution are permitted while retaining attribution and the license. Selling the software, including it in paid products or services, and other commercial use require prior written permission from the relevant rights holder(s). Contact the project maintainer **ayezhiest** for requests concerning the original project.

This is a source-available project with a noncommercial restriction, not an open-source license. [Русский перевод лицензии](LICENSE.ru.md).

Map imagery, derived third-party map data and the LuckyGames header originate from supplied game/mod assets. They and other third-party materials are excluded from this license and remain subject to their respective rights holders' terms.

Подробности на русском: [инструкция LuckyMap](app-lucky/README.md).
