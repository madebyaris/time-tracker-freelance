# ttf-002 — Richer clients + Claude-style tray timer

## Summary

A focused enhancement on top of the shipped Tickr (ttf-001) build. Three loosely-coupled tracks that share UI plumbing (tray panel, project picker, sync schema) and ship together as `ttf-002`:

1. **Richer client profile.** Clients gain a logo (synced base64), website, phone, address, tax ID, and a default hourly rate so invoices and the picker feel "branded" instead of letter-chip placeholders.
2. **Claude-style tray panel.** Replace today's compact `TimerBar` rendering with a focused single-card panel: a "what are you working on?" input, a project chip, and a big start / stop button. When running, the same shell flips into a "now-tracking" mode with timer text and pause/stop.
3. **Live timer in the macOS menubar.** While a timer runs, the tray icon's title text ticks every second (`mm:ss` then `h:mm`), so the user always knows time is being captured even with the app hidden. Pause clears the title back to the icon.

## Status

- **Spec**: this brief + [plan.md](plan.md)
- **Implementation**: shipped — see [progress.md](progress.md) and [todo-list.md](todo-list.md)
- **Depends on**: shipped ttf-001 (sync engine, tray plumbing, Clients/Tasks views)

## Goals

- Make clients feel like first-class entities (a logo + the contact fields a freelancer needs for an invoice).
- Reduce the friction of starting/stopping a timer from anywhere on macOS — no need to focus the main window.
- Give the user a constant, ambient signal that "yes, time is being tracked" via the menubar.

## Non-goals (deferred)

- Cloud-hosted blob storage for logos (R2/S3) — base64 in the row is enough until logos get heavy.
- True paused state on `time_entries` (a `paused_at` column + accumulator). v1 treats pause as quick-stop; resume starts a fresh entry pre-filled with the same description and project.
- Branded invoice PDF templates — out of scope for `ttf-002`; shipped later as [`ttf-003`](../ttf-003/feature-brief.md).
- System-wide hotkey escalation (currently uses Tauri's app-level global shortcut).

## SDD

This feature is tracked in `specs/active/ttf-002/` per SDD 5.0. Plan execution follows [plan.md](plan.md) → `tasks.md` (generated next) → `progress.md`.
