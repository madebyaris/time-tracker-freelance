# ttf-001 — Progress log

| Date (UTC) | Note |
|------------|------|
| 2026-04-24 | Initial implementation pass: monorepo, desktop app, API, web stub, sync, Docker Postgres, Cloudflare worker stub, SDD `specs/active/ttf-001` package. |
| 2026-04-24 | `idle` detection uses `CGEventSourceSecondsSinceLastEventType` via CoreGraphics C binding. |
| 2026-04-24 | API auth: JWT (jose) + bcrypt; not full `better-auth` yet. |
| 2026-04-24 | Desktop UX pass: flatter macOS-style shell, improved typography scale, custom shadcn-style primitives (`Combobox`, `Field`, `Section`, `EmptyState`, `SegmentedControl`, `Kbd`), and responsive sidebar behavior. |
| 2026-04-24 | Timer flow updated to support grouped project/client selection and direct client-only entries without requiring a project. |
| 2026-04-24 | Tray behavior updated: left-click opens a quick-timer popover window with task, selection, and start/stop controls; main and panel windows stay synced via `timer://changed`. |
| 2026-04-24 | Day view now supports manual/custom time entry for backfilling missed sessions. |
| 2026-04-24 | Window dragging fixed for overlay-titlebar mode by adding `core:window:allow-start-dragging` capability and explicit `startDragging()` handling in the desktop shell. |
| 2026-04-24 | Added a Tasks layer: synced `tasks` table across SQLite / Postgres / D1, new `Tasks` view with Today / Overdue / Upcoming / Inbox / Recently completed sections, inline create+edit, completion checkbox, and "Start" action that launches the timer pre-filled with the task's title and project/client. Added as the 2nd sidebar tab (Cmd+2). |
