# ttf-005 — Todo List

## T1 Shared aggregation module

- [x] T1.1 Add `apps/desktop/src/lib/reporting.ts` with half-open range resolution, entry facts, filters, and aggregation.
- [x] T1.2 Define the range convention: inclusive local start-of-day `from`, exclusive `to`.
- [x] T1.3 Separate billable *intent* (the `billable` column) from *revenue-eligible* (a resolved rate).
- [x] T1.4 Replace UTC-derived day bucket labels with local `dayKey` / `dayLabel`.
- [x] T1.5 Make day arithmetic DST-safe via `addDays` rather than adding `86_400_000`.
- [x] T1.6 Refactor `DayView` onto `aggregateTotals`.
- [x] T1.7 Refactor `TimeLogView` onto `resolveRange`, `aggregateTotals`, and the shared filter helpers.
- [x] T1.8 Delete the duplicated `formatRevenue` and local filter predicates.

## T2 Date ranges

- [x] T2.1 Add calendar-aware presets: this week, this month, last month, this quarter, this year.
- [x] T2.2 Add custom from/to date inputs to Reports.
- [x] T2.3 Persist range, grouping, billable filter, and custom dates in the `settings` table via `report-prefs.ts`.
- [x] T2.4 Validate stored preference values and fall back to defaults when unrecognised.
- [x] T2.5 Show the resolved span and day count under the heading.

## T3 Grouping

- [x] T3.1 Add a group-by selector: project, client, source.
- [x] T3.2 Roll client totals up across all of that client's projects.
- [x] T3.3 Give clients and sources stable hash-derived colours.
- [x] T3.4 Relabel the chart and table headers to match the active grouping.

## T4 Billable split

- [x] T4.1 Add Tracked / Billable / Non-billable stat cards.
- [x] T4.2 Add an effective hourly rate card, suppressed when currencies are mixed.
- [x] T4.3 Add a billable filter matching Time Log's.
- [x] T4.4 Add a per-group billable hours column.
- [x] T4.5 Warn when time is flagged billable but has no resolvable rate.

## T5 Export

- [x] T5.1 Extend `exportEntriesCsv` with source, billable, and target filters plus a filename label.
- [x] T5.2 Add `entry_id`, `project_id`, and `client_id` columns.
- [x] T5.3 Add an Export CSV button to Reports using the active range and billable filter.
- [x] T5.4 Add an Export button to Time Log using its range, source, billable, and target filters.
- [x] T5.5 Keep the Settings export as the "everything" escape hatch.

## T6 Verification

- [x] T6.1 `pnpm typecheck`
- [x] T6.2 `pnpm --filter @ttf/desktop build`
