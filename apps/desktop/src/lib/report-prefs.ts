/**
 * Reports tab preferences, persisted in the local-only `settings` table so the
 * view reopens where you left it. Unrecognised stored values fall back to the
 * default rather than throwing, so a downgrade can't break the tab.
 */

import { startOfDay } from '@ttf/shared';
import { Settings } from '../db/repos';
import {
  dateInputValue,
  isBillableFilter,
  isGroupBy,
  isRangePreset,
  type BillableFilter,
  type GroupBy,
  type RangePreset,
} from './reporting';

export interface ReportPrefs {
  range: RangePreset;
  groupBy: GroupBy;
  billable: BillableFilter;
  /** `YYYY-MM-DD`, only meaningful when `range` is `custom`. */
  customFrom: string;
  customTo: string;
}

const KEYS = {
  range: 'reports_range',
  groupBy: 'reports_group_by',
  billable: 'reports_billable_filter',
  customFrom: 'reports_custom_from',
  customTo: 'reports_custom_to',
} as const;

const DATE_INPUT_RE = /^\d{4}-\d{2}-\d{2}$/;

export function defaultReportPrefs(now: number = Date.now()): ReportPrefs {
  const today = startOfDay(now);
  return {
    range: '30d',
    groupBy: 'project',
    billable: 'all',
    customFrom: dateInputValue(today - 29 * 86_400_000),
    customTo: dateInputValue(today),
  };
}

export async function loadReportPrefs(): Promise<ReportPrefs> {
  const defaults = defaultReportPrefs();
  const [range, groupBy, billable, customFrom, customTo] = await Promise.all([
    Settings.get(KEYS.range),
    Settings.get(KEYS.groupBy),
    Settings.get(KEYS.billable),
    Settings.get(KEYS.customFrom),
    Settings.get(KEYS.customTo),
  ]);

  return {
    range: isRangePreset(range) ? range : defaults.range,
    groupBy: isGroupBy(groupBy) ? groupBy : defaults.groupBy,
    billable: isBillableFilter(billable) ? billable : defaults.billable,
    customFrom: customFrom && DATE_INPUT_RE.test(customFrom) ? customFrom : defaults.customFrom,
    customTo: customTo && DATE_INPUT_RE.test(customTo) ? customTo : defaults.customTo,
  };
}

export async function saveReportPrefs(patch: Partial<ReportPrefs>): Promise<void> {
  await Promise.all(
    Object.entries(patch)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => Settings.set(KEYS[key as keyof ReportPrefs], String(value))),
  );
}
