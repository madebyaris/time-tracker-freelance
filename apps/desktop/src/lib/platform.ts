/**
 * Platform-specific preferences and capabilities.
 *
 * Keyboard hints come from the Rust side rather than being derived from the
 * platform here, so what the UI shows can never disagree with what actually got
 * registered.
 */

import { invoke } from '@tauri-apps/api/core';
import { platform } from '@tauri-apps/plugin-os';
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';
import { Settings } from '../db/repos';

export const HIDE_DOCK_ICON_KEY = 'hide_dock_icon';

export function isMacOS(): boolean {
  try {
    return platform() === 'macos';
  } catch {
    return false;
  }
}

export interface ShortcutIssue {
  action: string;
  accelerator: string;
  error: string;
}

export interface ShortcutInfo {
  toggleTimer: string;
  quickPanel: string;
  issues: ShortcutIssue[];
}

const FALLBACK_SHORTCUTS: ShortcutInfo = {
  toggleTimer: '',
  quickPanel: '',
  issues: [],
};

export async function getShortcutInfo(): Promise<ShortcutInfo> {
  try {
    return await invoke<ShortcutInfo>('shortcut_info');
  } catch {
    return FALLBACK_SHORTCUTS;
  }
}

export async function setDockIconVisible(visible: boolean): Promise<void> {
  await invoke('set_dock_icon_visible', { visible });
}

export async function isAutostartEnabled(): Promise<boolean> {
  try {
    return await isEnabled();
  } catch {
    return false;
  }
}

export async function setAutostartEnabled(enabled: boolean): Promise<void> {
  if (enabled) {
    await enable();
  } else {
    await disable();
  }
}

/**
 * Re-apply preferences the OS does not remember across launches. The Dock icon
 * always appears briefly before this runs — hiding it earlier would mean
 * baking the choice into the bundle rather than making it a setting.
 */
export async function applyPlatformPreferences(): Promise<void> {
  if (!isMacOS()) return;
  const hideDock = (await Settings.get(HIDE_DOCK_ICON_KEY)) === '1';
  if (hideDock) {
    await setDockIconVisible(false).catch(() => {
      // A refused activation-policy change should not block startup.
    });
  }
}
