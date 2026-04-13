import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MachineProvider } from '../../src/provider/MachineProvider';
import { MockCommLayer } from '../../src/mock/MockCommLayer';
import { useMomentary } from '../../src/hooks/useMomentary';
import { MachineRegistry } from '../../src/registry/MachineRegistry';

// ---------------------------------------------------------------------------
// Test component
// ---------------------------------------------------------------------------

function MomentaryButton({
  path = 'Motor.Jog',
  pressValue,
  releaseValue,
  intervalMs,
  heartbeatPath,
  heartbeatValue,
  machineId,
}: {
  path?: string;
  pressValue?: unknown;
  releaseValue?: unknown;
  intervalMs?: number;
  heartbeatPath?: string;
  heartbeatValue?: unknown;
  machineId?: string;
}) {
  const { pressed, handlers } = useMomentary(path, {
    pressValue,
    releaseValue,
    intervalMs,
    heartbeatPath,
    heartbeatValue,
    machineId,
  });
  return (
    <button {...handlers} data-testid="btn">
      {pressed ? 'pressed' : 'idle'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let machineCounter = 0;
function freshId() {
  return `momentary-test-${++machineCounter}`;
}

function setup(props: Parameters<typeof MomentaryButton>[0] = {}) {
  const mock = new MockCommLayer();
  const id = freshId();
  const result = render(
    <MachineProvider id={id} machine={mock}>
      <MomentaryButton {...props} />
    </MachineProvider>,
  );
  const btn = screen.getByTestId('btn');
  return { mock, id, btn, ...result };
}

function pointerDown(el: HTMLElement) {
  // jsdom doesn't implement setPointerCapture — stub it so the hook doesn't throw.
  if (!el.setPointerCapture) {
    el.setPointerCapture = () => {};
  }
  fireEvent.pointerDown(el, { pointerId: 1 });
}
function pointerUp(el: HTMLElement) {
  fireEvent.pointerUp(el, { pointerId: 1 });
}
function pointerLeave(el: HTMLElement) {
  fireEvent.pointerLeave(el, { pointerId: 1 });
}
function pointerCancel(el: HTMLElement) {
  fireEvent.pointerCancel(el, { pointerId: 1 });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  // jsdom doesn't clean up fake timers between tests automatically
  vi.useRealTimers();
});

describe('useMomentary — basic press / release', () => {
  it('writes true on press and false on release (defaults)', async () => {
    const { mock, id, btn } = setup();

    await act(async () => { pointerDown(btn); });
    expect(mock.getLastWrittenValue('Motor.Jog')).toBe(true);
    expect(btn.textContent).toBe('pressed');

    await act(async () => { pointerUp(btn); });
    expect(mock.getLastWrittenValue('Motor.Jog')).toBe(false);
    expect(btn.textContent).toBe('idle');

    MachineRegistry.unregisterMachine(id);
  });

  it('respects custom pressValue and releaseValue', async () => {
    const { mock, id, btn } = setup({ pressValue: 500, releaseValue: 0 });

    await act(async () => { pointerDown(btn); });
    expect(mock.getLastWrittenValue('Motor.Jog')).toBe(500);

    await act(async () => { pointerUp(btn); });
    expect(mock.getLastWrittenValue('Motor.Jog')).toBe(0);

    MachineRegistry.unregisterMachine(id);
  });

  it('releases on pointerLeave', async () => {
    const { mock, id, btn } = setup();

    await act(async () => { pointerDown(btn); });
    await act(async () => { pointerLeave(btn); });

    expect(mock.getLastWrittenValue('Motor.Jog')).toBe(false);
    expect(btn.textContent).toBe('idle');

    MachineRegistry.unregisterMachine(id);
  });

  it('releases on pointerCancel', async () => {
    const { mock, id, btn } = setup();

    await act(async () => { pointerDown(btn); });
    await act(async () => { pointerCancel(btn); });

    expect(mock.getLastWrittenValue('Motor.Jog')).toBe(false);

    MachineRegistry.unregisterMachine(id);
  });

  it('ignores duplicate press without release', async () => {
    const { mock, id, btn } = setup();
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    await act(async () => { pointerDown(btn); });
    await act(async () => { pointerDown(btn); }); // duplicate

    // Should have written pressValue only once
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenCalledWith('Motor.Jog', true);

    MachineRegistry.unregisterMachine(id);
  });

  it('ignores release when not pressed', async () => {
    const { mock, id, btn } = setup();
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    await act(async () => { pointerUp(btn); }); // no prior press

    expect(writeSpy).not.toHaveBeenCalled();

    MachineRegistry.unregisterMachine(id);
  });
});

describe('useMomentary — interval (jog mode)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('re-writes pressValue on each interval tick while held', async () => {
    const { mock, id, btn } = setup({ intervalMs: 100 });
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    await act(async () => { pointerDown(btn); });

    // Initial press write
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(writeSpy).toHaveBeenLastCalledWith('Motor.Jog', true);

    // Advance 100 ms — one tick
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(writeSpy).toHaveBeenCalledTimes(2);

    // Advance another 100 ms — second tick
    await act(async () => { vi.advanceTimersByTime(100); });
    expect(writeSpy).toHaveBeenCalledTimes(3);

    await act(async () => { pointerUp(btn); });

    // No more ticks after release
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(writeSpy).toHaveBeenCalledTimes(4); // only the release write

    MachineRegistry.unregisterMachine(id);
  });

  it('writes heartbeatValue to heartbeatPath on each tick', async () => {
    const { mock, id, btn } = setup({
      intervalMs: 100,
      heartbeatPath: 'Motor.JogAlive',
    });
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    await act(async () => { pointerDown(btn); });
    await act(async () => { vi.advanceTimersByTime(100); });

    // Tick should have written both the main path and the heartbeat
    const calls = writeSpy.mock.calls;
    const tickCalls = calls.filter(([path]) => path === 'Motor.JogAlive');
    expect(tickCalls.length).toBeGreaterThanOrEqual(1);
    expect(tickCalls[0][1]).toBe(true); // default heartbeatValue

    MachineRegistry.unregisterMachine(id);
  });

  it('respects custom heartbeatValue', async () => {
    const { mock, id, btn } = setup({
      intervalMs: 100,
      heartbeatPath: 'Motor.JogAlive',
      heartbeatValue: 42,
    });
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    await act(async () => { pointerDown(btn); });
    await act(async () => { vi.advanceTimersByTime(100); });

    const heartbeatCalls = writeSpy.mock.calls.filter(([path]) => path === 'Motor.JogAlive');
    expect(heartbeatCalls[0][1]).toBe(42);

    MachineRegistry.unregisterMachine(id);
  });

  it('stops interval on release', async () => {
    const { mock, id, btn } = setup({ intervalMs: 100 });
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    await act(async () => { pointerDown(btn); });
    await act(async () => { vi.advanceTimersByTime(250); }); // 2 ticks

    const countAfterHold = writeSpy.mock.calls.length;

    await act(async () => { pointerUp(btn); });
    await act(async () => { vi.advanceTimersByTime(500); }); // interval should be cleared

    // Only one extra call: the release write
    expect(writeSpy.mock.calls.length).toBe(countAfterHold + 1);

    MachineRegistry.unregisterMachine(id);
  });
});

describe('useMomentary — cleanup on unmount', () => {
  it('writes releaseValue on unmount if pressed', async () => {
    const { mock, id, btn, unmount } = setup();

    await act(async () => { pointerDown(btn); });
    expect(mock.getLastWrittenValue('Motor.Jog')).toBe(true);

    await act(async () => { unmount(); });

    expect(mock.getLastWrittenValue('Motor.Jog')).toBe(false);

    MachineRegistry.unregisterMachine(id);
  });

  it('does not write on unmount if not pressed', async () => {
    const { mock, id, unmount } = setup();
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    await act(async () => { unmount(); });

    expect(writeSpy).not.toHaveBeenCalled();

    MachineRegistry.unregisterMachine(id);
  });

  it('clears interval on unmount', async () => {
    vi.useFakeTimers();
    const { mock, id, btn, unmount } = setup({ intervalMs: 100 });
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    await act(async () => { pointerDown(btn); });
    await act(async () => { vi.advanceTimersByTime(100); }); // 1 tick
    const countBeforeUnmount = writeSpy.mock.calls.length;

    await act(async () => { unmount(); });
    await act(async () => { vi.advanceTimersByTime(500); }); // should not fire

    // Only the release write after unmount
    expect(writeSpy.mock.calls.length).toBe(countBeforeUnmount + 1);

    MachineRegistry.unregisterMachine(id);
  });
});

describe('useMomentary — pagehide cleanup', () => {
  it('writes releaseValue on pagehide if pressed', async () => {
    const { mock, id, btn } = setup();

    await act(async () => { pointerDown(btn); });

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(mock.getLastWrittenValue('Motor.Jog')).toBe(false);

    MachineRegistry.unregisterMachine(id);
  });

  it('does not write on pagehide if not pressed', async () => {
    const { mock, id } = setup();
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(writeSpy).not.toHaveBeenCalled();

    MachineRegistry.unregisterMachine(id);
  });
});
