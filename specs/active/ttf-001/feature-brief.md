# ttf-001 — Tickr (Indie Freelancer Time Tracker)

## Summary

**Tickr** is a local-first Tauri + React macOS time tracker for indie freelancers with optional Hono/Postgres (or D1) backend, React web dashboard, sync, invoicing, and native hooks (tray, shortcuts, idle, Pomodoro).

The current desktop app now includes a refined macOS-style shell, responsive sidebar layout, grouped project/client picker, tray quick-timer popover, client-only time entries, manual backfill for missed sessions, and a dedicated Tasks layer (Today / Upcoming / Inbox / Completed) where each task can launch the timer pre-filled with its title and project.

## Status

- **Spec**: this brief + [spec.md](spec.md)
- **Implementation**: in-repo under `apps/`, `packages/`, `infra/`
- **Current focus**: polish the desktop-first UX and keep spec/docs aligned with the implemented behavior

## SDD

This feature is tracked in `specs/active/ttf-001/` per SDD 5.0. Plan execution follows [tasks.md](tasks.md); updates go in [progress.md](progress.md).
