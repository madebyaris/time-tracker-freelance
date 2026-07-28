/**
 * Feeds the macOS widget.
 *
 * The snapshot is assembled here rather than in Rust because only this layer
 * knows project and client names and can roll up today's totals — see
 * `src-tauri/src/widget.rs` for why a file is used instead of an App Group.
 *
 * Runs in the main window only. The quick panel shares the same timer store, so
 * starting it in both would double every write.
 */

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { entryDurationSeconds, startOfDay } from '@ttf/shared';
import { Clients, Projects, TimeEntries } from '../db/repos';
import { aggregateTotals, resolveEntryContext } from './reporting';
import { isMacOS } from './platform';

/** Mirrors `WidgetSnapshot` in `widget.rs` and `TickrState` in `WidgetState.swift`. */
interface WidgetSnapshot {
  running: boolean;
  paused: boolean;
  startedAt: number | null;
  pausedElapsedSeconds: number | null;
  entryDescription: string | null;
  projectName: string | null;
  clientName: string | null;
  todayTrackedSeconds: number;
  todayBillableSeconds: number;
}

export interface WidgetStatus {
  supported: boolean;
  embedded: boolean;
}

const TIMER_CHANGED = 'timer://changed';

/**
 * How often today's totals are re-published without asking for a widget reload.
 * WidgetKit budgets reloads to tens per day, so only real state transitions get
 * one; this keeps the file itself current for whenever the widget next refreshes.
 */
const TOTALS_REFRESH_MS = 60_000;

export function getWidgetStatus(): Promise<WidgetStatus> {
  return invoke<WidgetStatus>('widget_status').catch(() => ({
    supported: false,
    embedded: false,
  }));
}

async function buildSnapshot(): Promise<WidgetSnapshot> {
  const dayStart = startOfDay(Date.now());
  const [running, entries, projects, clients] = await Promise.all([
    TimeEntries.getRunning(),
    TimeEntries.list({ from: dayStart, to: dayStart + 86_400_000 }),
    Projects.list({ includeArchived: true }),
    Clients.list(),
  ]);

  const projById = new Map(projects.map((p) => [p.id, p]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const totals = aggregateTotals(entries, projById, clientById);

  const base = {
    todayTrackedSeconds: totals.seconds,
    todayBillableSeconds: totals.billableSeconds,
  };

  if (!running) {
    return {
      running: false,
      paused: false,
      startedAt: null,
      pausedElapsedSeconds: null,
      entryDescription: null,
      projectName: null,
      clientName: null,
      ...base,
    };
  }

  const ctx = resolveEntryContext(running, projById, clientById);
  const paused = running.paused_at != null;

  return {
    running: true,
    paused,
    // Shifted forward by accumulated pause time so the widget renders elapsed as
    // `now - startedAt` and needs no pause logic of its own.
    startedAt: running.started_at + running.paused_seconds * 1000,
    pausedElapsedSeconds: paused ? entryDurationSeconds(running) : null,
    entryDescription: running.description,
    projectName: ctx.project?.name ?? null,
    clientName: ctx.client?.name ?? null,
    ...base,
  };
}

async function publish(refresh: boolean): Promise<void> {
  try {
    await invoke('write_widget_state', { snapshot: await buildSnapshot(), refresh });
  } catch {
    // A widget that falls behind is not worth interrupting time tracking for.
  }
}

let started = false;

export function startWidgetBridge(): void {
  if (started || !isMacOS()) return;
  started = true;

  void publish(true);

  void listen(TIMER_CHANGED, () => {
    void publish(true);
  });

  setInterval(() => {
    void publish(false);
  }, TOTALS_REFRESH_MS);
}
