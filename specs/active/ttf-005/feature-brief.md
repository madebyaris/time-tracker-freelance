# ttf-005 — Reports fundamentals

## Summary

Make the Reports tab answer the questions a freelancer actually asks at the end of a month: how much did each **client** get, how much of it was **billable**, what was my **effective hourly rate**, and can I get that out as a CSV that matches what I'm looking at.

Today Reports is limited to 7/30/90-day presets grouped by project, with no client rollup, no billable split, and a CSV export that lives only in Settings with a hardcoded ~365-day window.

## Status

- **Spec**: shipped — see [todo-list.md](todo-list.md) and [progress.md](progress.md)
- **Implementation**: shipped
- **Depends on**: shipped ttf-001 core tracker, shipped ttf-002 client profile fields

## Goals

- One shared aggregation module so Reports, Time Log, and Day agree on totals.
- Fix the range-boundary and billable-semantics drift between views.
- Custom date range plus calendar-aware presets (week / month / last month / quarter / year), remembered between sessions.
- Group by project, **client (rolled up across that client's projects)**, or source.
- Billable vs non-billable split and effective hourly rate.
- CSV export that honors the filters currently on screen.

## Non-goals

- No tag-based reporting. `tags` / `entry_tags` exist in the schema and sync but there is no `Tags` repo and no tagging UI, so a tag breakdown would be reporting on data that cannot be entered. Tagging is its own feature.
- No SQL `GROUP BY` aggregation. Aggregation stays client-side; revisit only if profiling shows a problem.
- No PDF/print time report — invoices remain the only PDF deliverable.
- No utilization targets, goals, or capacity planning.
- No changes to the web dashboard's reporting.

## Problems Being Fixed

| Problem | Where |
|---|---|
| `to = Date.now()` instead of end-of-day, so Reports and Time Log disagree on the same preset | `ReportsView.tsx` |
| "Billable" means the `billable` column in one place and "has a resolved rate" in another | `ReportsView` vs `TimeLogView` vs `csv.ts` |
| Day-bucket labels derived from `toISOString()` on a local midnight, shifting labels by a day in non-UTC timezones | `ReportsView.tsx` |
| A client is only visible when an entry has no project, so per-client totals are impossible | `ReportsView.tsx` |
| Aggregation logic duplicated across four views | Reports / TimeLog / Day / web |

## Decisions

- **Range convention**: `from` is inclusive local start-of-day, `to` is the exclusive start of the day after the last day. All views use `resolveRange`.
- **Billable vocabulary**: `billable` column = *intent*; a resolved rate = *revenue-eligible*. Reports shows both, so "billable hours with no rate" is visible rather than silently dropped.
- **Effective hourly rate** = revenue / revenue-eligible hours, shown only when a single currency is in play.
- Range and grouping preferences persist in the existing local-only `settings` table, consistent with the invoice profile.

## Changelog

### 2026-07-28 - Addition: Reports fundamentals planned

**Context**: Core tracking, invoicing, and deployment shipped in ttf-001 through ttf-004. Reporting was the weakest part of the product relative to how often a freelancer needs it.

**Change**: Planned `ttf-005` around client rollups, billable splits, calendar-aware ranges, and filter-aware export, on top of a single shared aggregation module.

**Impact**: Removes a class of correctness bugs (range boundaries, billable semantics, timezone-shifted labels) while adding the reporting dimensions that were missing.

**Decision**: Exclude tag reporting until tagging exists as a user-facing feature.
