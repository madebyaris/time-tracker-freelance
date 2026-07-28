import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));
vi.mock('../state/timer', () => ({
  useTimer: {
    getState: () => ({ pause: mocks.pause, resume: mocks.resume }),
  },
}));

import { schedulePendingTimerActions } from './deep-link-actions';

describe('deep-link timer actions', () => {
  it('serializes rapid pause then resume drains', async () => {
    const order: string[] = [];
    let releasePause!: () => void;
    const pauseGate = new Promise<void>((resolve) => {
      releasePause = resolve;
    });

    mocks.invoke
      .mockResolvedValueOnce(['pause'])
      .mockResolvedValueOnce(['resume']);
    mocks.pause.mockImplementationOnce(async () => {
      order.push('pause:start');
      await pauseGate;
      order.push('pause:end');
    });
    mocks.resume.mockImplementationOnce(async () => {
      order.push('resume');
    });

    const pauseDrain = schedulePendingTimerActions();
    await vi.waitFor(() => expect(mocks.pause).toHaveBeenCalledOnce());

    const resumeDrain = schedulePendingTimerActions();
    expect(mocks.invoke).toHaveBeenCalledTimes(1);

    releasePause();
    await Promise.all([pauseDrain, resumeDrain]);

    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(order).toEqual(['pause:start', 'pause:end', 'resume']);
  });
});
