# ttf-005 — Progress

## Status: shipped

## What Changed

| Area | File | Change |
|---|---|---|
| Aggregation | `apps/desktop/src/lib/reporting.ts` | New. Ranges, entry facts, filters, grouping, totals. |
| Preferences | `apps/desktop/src/lib/report-prefs.ts` | New. Reports prefs persisted in the local `settings` table. |
| Reports | `apps/desktop/src/views/ReportsView.tsx` | Rewritten around the shared module; adds presets, custom range, grouping, billable split, effective rate, export. |
| Time Log | `apps/desktop/src/views/TimeLogView.tsx` | Uses shared range/totals/filters; gained a filter-aware export button. |
| Day | `apps/desktop/src/views/DayView.tsx` | Totals come from `aggregateTotals`. |
| Export | `apps/desktop/src/lib/csv.ts` | Filter support, filename labels, and `entry_id` / `project_id` / `client_id` columns. |
| Settings | `apps/desktop/src/views/SettingsView.tsx` | Full export now labels its file `all`. |

## Bugs Fixed Along the Way

1. **Range boundary mismatch** — Reports used `to = Date.now()` while Time Log used end-of-day, so the same preset produced different totals. Both now use `resolveRange`.
2. **Timezone-shifted chart labels** — day buckets were keyed by `toISOString()` applied to a *local* midnight, which lands on the previous date in any positive-UTC-offset zone. Keys and labels are now computed locally.
3. **DST drift** — day stepping used `+ 86_400_000`; it now uses calendar-aware `addDays`.
4. **Ambiguous "billable"** — three definitions existed across views. Now `billable` is intent and a resolved rate is revenue-eligibility, with both surfaced.

## Notable Decisions

- Aggregation stays client-side. The `time_entries_started_idx` index covers the range scan and datasets are small for a solo freelancer; SQL `GROUP BY` can come later if profiling demands it.
- Client grouping rolls up through `project.client_id` and falls back to `entry.client_id`, so a client's total spans all of its projects.
- Effective hourly rate is suppressed when more than one currency is present rather than blending incomparable amounts.
- Time flagged billable with no resolvable rate gets an explicit warning instead of vanishing from revenue silently.

## Deferred

- Tag-based reporting — blocked on there being any way to tag an entry (`tags` / `entry_tags` exist in schema and sync only).
- Printable/PDF time report.
- Utilization targets and goals.
- Web dashboard reporting parity.

## Verification

- `pnpm typecheck` — 9/9 tasks pass
- `pnpm --filter @ttf/desktop build` — builds clean
