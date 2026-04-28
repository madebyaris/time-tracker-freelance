import { Combobox, Field, FieldHint, FieldLabel, Input, type ComboboxOption } from '@ttf/ui';
import { centsToRateOverride, rateOverrideToCents } from '../lib/rate';

export { centsToRateOverride, rateOverrideToCents };

/**
 * Shared editor for time entries (used by Day and Time Log views).
 *
 * The "rate" input is in major currency units (e.g. dollars), but the
 * underlying value passed back via `onRateOverrideChange` is the raw string
 * — the caller is responsible for parsing to cents on save. Empty string =
 * no override.
 */
export interface EntryFormValue {
  description: string;
  target: string | null;
  date: string;
  start: string;
  end: string;
  billable: boolean;
  rateOverride: string;
}

export interface EntryFormFieldsProps {
  value: EntryFormValue;
  onChange: (next: EntryFormValue) => void;
  targetOptions: ComboboxOption[];
  /** Currency code (USD, EUR, …) shown next to the rate input. */
  rateCurrency: string;
  /**
   * Inherited rate (cents/hour) that would apply if no override is set.
   * Used to render a helper hint under the rate field.
   */
  inheritedRateCents?: number | null;
  inheritedRateSource?: 'project' | 'client' | null;
  /** Hide the billable + rate fields (e.g. when caller doesn't manage them). */
  showBilling?: boolean;
}

export function EntryFormFields({
  value,
  onChange,
  targetOptions,
  rateCurrency,
  inheritedRateCents,
  inheritedRateSource,
  showBilling = true,
}: EntryFormFieldsProps) {
  function patch<K extends keyof EntryFormValue>(key: K, next: EntryFormValue[K]) {
    onChange({ ...value, [key]: next });
  }

  const inheritedHint = renderInheritedHint(
    value.billable,
    value.rateOverride,
    inheritedRateCents ?? null,
    inheritedRateSource ?? null,
    rateCurrency,
  );

  return (
    <>
      <Field className="md:col-span-2">
        <FieldLabel>Task</FieldLabel>
        <Input
          value={value.description}
          onChange={(event) => patch('description', event.target.value)}
          placeholder="What were you working on?"
        />
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel>Project or client</FieldLabel>
        <Combobox
          value={value.target}
          onChange={(next) => patch('target', next)}
          options={targetOptions}
          placeholder="No project"
          searchPlaceholder="Find project or client…"
          emptyLabel="No projects or clients yet"
        />
      </Field>
      <Field>
        <FieldLabel>Date</FieldLabel>
        <Input
          type="date"
          value={value.date}
          onChange={(event) => patch('date', event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel>Start</FieldLabel>
        <Input
          type="time"
          value={value.start}
          onChange={(event) => patch('start', event.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel>End</FieldLabel>
        <Input
          type="time"
          value={value.end}
          onChange={(event) => patch('end', event.target.value)}
        />
      </Field>

      {showBilling && (
        <>
          <Field>
            <FieldLabel>Billable</FieldLabel>
            <label className="inline-flex h-9 items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900"
                checked={value.billable}
                onChange={(event) => patch('billable', event.target.checked)}
              />
              <span>Counts toward revenue and invoices</span>
            </label>
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel>Hourly rate override ({rateCurrency}/h)</FieldLabel>
            <Input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder={
                inheritedRateCents
                  ? (inheritedRateCents / 100).toFixed(2)
                  : 'Use project / client rate'
              }
              value={value.rateOverride}
              onChange={(event) => patch('rateOverride', event.target.value)}
              disabled={!value.billable}
            />
            {inheritedHint && <FieldHint>{inheritedHint}</FieldHint>}
          </Field>
        </>
      )}
    </>
  );
}

function renderInheritedHint(
  billable: boolean,
  override: string,
  inheritedRateCents: number | null,
  source: 'project' | 'client' | null,
  currency: string,
): string | null {
  if (!billable) return 'Marked non-billable — no revenue is calculated.';
  const trimmed = override.trim();
  if (trimmed) {
    return `Override applied. Leave blank to use the ${source ?? 'default'} rate.`;
  }
  if (inheritedRateCents && source) {
    return `Using ${(inheritedRateCents / 100).toFixed(2)} ${currency}/h from the ${source}.`;
  }
  return 'No project or client rate set — revenue stays at zero unless you enter an override.';
}
