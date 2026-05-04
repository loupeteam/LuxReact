import { describe, it, expect, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MachineProvider } from '../../src/provider/MachineProvider';
import { VariableScope } from '../../src/provider/VariableScope';
import { MockCommLayer } from '../../src/mock/MockCommLayer';
import { useVariable } from '../../src/hooks/useVariable';
import { MachineRegistry } from '../../src/registry/MachineRegistry';

function SpeedDisplay({
  path = 'Motor.Speed',
  machineId,
  optimistic,
}: {
  path?: string;
  machineId?: string;
  optimistic?: boolean;
}) {
  const [value, setValue, meta] = useVariable<number>(path, { optimistic }, machineId);
  return (
    <div>
      <span data-testid="value">{value ?? 'undef'}</span>
      <span data-testid="loading">{String(meta.loading)}</span>
      <span data-testid="quality">{meta.quality ?? 'null'}</span>
      <button onClick={() => setValue(9999)}>set</button>
    </div>
  );
}

function SpeedDisplayWithError({
  path = 'Motor.Speed',
  optimistic,
}: {
  path?: string;
  optimistic?: boolean;
}) {
  const [value, setValue, meta] = useVariable<number>(path, { optimistic });
  return (
    <div>
      <span data-testid="value">{value ?? 'undef'}</span>
      <span data-testid="error">{meta.error?.message ?? 'null'}</span>
      <button onClick={() => setValue(9999).catch(() => {})}>set</button>
    </div>
  );
}

describe('useVariable write failure', () => {
  it('reads actual value from server after a failed write (non-optimistic)', async () => {
    const mock = new MockCommLayer();
    mock.setVariableValue('Motor.Speed', 42);
    vi.spyOn(mock, 'writeVariable').mockRejectedValue(new Error('read-only'));
    const readSpy = vi.spyOn(mock, 'readVariable');

    render(
      <MachineProvider id="v-fail-nonopt" machine={mock}>
        <SpeedDisplayWithError />
      </MachineProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('42'),
    );

    await act(async () => {
      screen.getByText('set').click();
    });

    // readVariable should have been called to fetch the authoritative value
    expect(readSpy).toHaveBeenCalledWith('Motor.Speed');

    // Error should be surfaced in meta
    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toBe('read-only'),
    );

    // Value should reflect what readVariable returned (still 42 from server)
    expect(screen.getByTestId('value').textContent).toBe('42');
    MachineRegistry.unregisterMachine('v-fail-nonopt');
  });

  it('reads actual value from server after a failed optimistic write', async () => {
    const mock = new MockCommLayer();
    mock.setVariableValue('Motor.Speed', 10);
    vi.spyOn(mock, 'writeVariable').mockRejectedValue(new Error('permission denied'));
    const readSpy = vi.spyOn(mock, 'readVariable');

    render(
      <MachineProvider id="v-fail-opt" machine={mock}>
        <SpeedDisplayWithError optimistic />
      </MachineProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('10'),
    );

    await act(async () => {
      screen.getByText('set').click();
    });

    // After optimistic write fails, readVariable should confirm the real value
    expect(readSpy).toHaveBeenCalledWith('Motor.Speed');

    // Value should be the server's actual value (10), not the failed write (9999)
    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('10'),
    );

    // Error should be surfaced
    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toBe('permission denied'),
    );
    MachineRegistry.unregisterMachine('v-fail-opt');
  });

  it('falls back to pre-write snapshot when both write and read fail', async () => {
    const mock = new MockCommLayer();
    mock.setVariableValue('Motor.Speed', 5);
    vi.spyOn(mock, 'writeVariable').mockRejectedValue(new Error('write failed'));
    vi.spyOn(mock, 'readVariable').mockRejectedValue(new Error('read failed'));

    render(
      <MachineProvider id="v-fail-both" machine={mock}>
        <SpeedDisplayWithError optimistic />
      </MachineProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('5'),
    );

    await act(async () => {
      screen.getByText('set').click();
    });

    // When read also fails, reverts to pre-write snapshot (5)
    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('5'),
    );
    MachineRegistry.unregisterMachine('v-fail-both');
  });

  it('optimistic: reads actual value after a successful write when PLC overrides (deadband regression)', async () => {
    // Simulates: PLC receives write of `true`, immediately resets to `false` within
    // one OPC UA sampling window. The subscription sees no value change and fires
    // no notification. Without a read-back on the success path, the UI would be
    // stuck showing the stale optimistic value (`true`).
    const mock = new MockCommLayer();
    mock.setVariableValue('Toggle', false);

    // Spy on readVariable — MockCommLayer will return the current stored value (false)
    const readSpy = vi.spyOn(mock, 'readVariable');

    function ToggleDisplay() {
      const [value, setValue] = useVariable<boolean>('Toggle', { defaultValue: false, optimistic: true });
      return (
        <div>
          <span data-testid="value">{String(value ?? false)}</span>
          <button onClick={() => void setValue(true)}>toggle</button>
        </div>
      );
    }

    render(
      <MachineProvider id="v-plc-reset" machine={mock}>
        <ToggleDisplay />
      </MachineProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('false'),
    );

    // Click — optimistic update fires immediately, write resolves with no subscription event
    // (PLC reset so fast that OPC UA deadband suppressed the notification)
    await act(async () => {
      screen.getByText('toggle').click();
    });

    // Should have read back the actual PLC value after the successful write
    expect(readSpy).toHaveBeenCalledWith('Toggle');

    // UI should reflect PLC's actual value (false), not the stale optimistic (true)
    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('false'),
    );

    MachineRegistry.unregisterMachine('v-plc-reset');
  });
});

describe('useVariable', () => {
  it('starts in loading state with no value', () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="v-test1" machine={mock}>
        <SpeedDisplay />
      </MachineProvider>,
    );
    expect(screen.getByTestId('loading').textContent).toBe('true');
    expect(screen.getByTestId('value').textContent).toBe('undef');
    MachineRegistry.unregisterMachine('v-test1');
  });

  it('updates value and clears loading when PLC sends a value', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="v-test2" machine={mock}>
        <SpeedDisplay />
      </MachineProvider>,
    );

    await act(async () => {
      mock.setVariableValue('Motor.Speed', 1200);
    });

    await waitFor(() => {
      expect(screen.getByTestId('value').textContent).toBe('1200');
      expect(screen.getByTestId('loading').textContent).toBe('false');
      expect(screen.getByTestId('quality').textContent).toBe('good');
    });
    MachineRegistry.unregisterMachine('v-test2');
  });

  it('calls writeVariable when setValue is invoked', async () => {
    const mock = new MockCommLayer();
    const writeSpy = vi.spyOn(mock, 'writeVariable');

    render(
      <MachineProvider id="v-test3" machine={mock}>
        <SpeedDisplay />
      </MachineProvider>,
    );

    await act(async () => {
      screen.getByText('set').click();
    });

    expect(writeSpy).toHaveBeenCalledWith('Motor.Speed', 9999);
    MachineRegistry.unregisterMachine('v-test3');
  });

  it('optimistic: updates value immediately on setValue', async () => {
    const mock = new MockCommLayer();
    // Give an initial value so loading is false
    mock.setVariableValue('Motor.Speed', 100);
    // Simulate PLC accepting the write — read-back returns the written value
    vi.spyOn(mock, 'readVariable').mockResolvedValue(9999);

    render(
      <MachineProvider id="v-optim" machine={mock}>
        <SpeedDisplay optimistic />
      </MachineProvider>,
    );

    // Wait for initial value flush
    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('100'),
    );

    await act(async () => {
      screen.getByText('set').click();
    });

    // After write + read-back, value should be what the PLC confirmed (9999)
    expect(screen.getByTestId('value').textContent).toBe('9999');
    MachineRegistry.unregisterMachine('v-optim');
  });

  it('resolves path through VariableScope prefix', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="v-scope" machine={mock}>
        <VariableScope prefix="Motor">
          <SpeedDisplay path="Speed" />
        </VariableScope>
      </MachineProvider>,
    );

    await act(async () => {
      mock.setVariableValue('Motor.Speed', 42);
    });

    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('42'),
    );
    MachineRegistry.unregisterMachine('v-scope');
  });

  it('stacks nested VariableScope prefixes when resolving path', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="v-nest-scope" machine={mock}>
        <VariableScope prefix="Motor">
          <VariableScope prefix="Axis[0]">
            <SpeedDisplay path="Pos" />
          </VariableScope>
        </VariableScope>
      </MachineProvider>,
    );

    await act(async () => {
      mock.setVariableValue('Motor.Axis[0].Pos', 77);
    });

    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('77'),
    );
    MachineRegistry.unregisterMachine('v-nest-scope');
  });

  it('ignoreScope: true bypasses the VariableScope prefix', async () => {
    const mock = new MockCommLayer();

    function AbsoluteDisplay() {
      const [value] = useVariable<number>('Global.Speed', { ignoreScope: true });
      return <span data-testid="value">{value ?? 'undef'}</span>;
    }

    render(
      <MachineProvider id="v-ignore-scope" machine={mock}>
        <VariableScope prefix="ShouldNotAppear">
          <AbsoluteDisplay />
        </VariableScope>
      </MachineProvider>,
    );

    // Only the un-prefixed path should receive the value
    await act(async () => {
      mock.setVariableValue('Global.Speed', 55);
    });

    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('55'),
    );
    MachineRegistry.unregisterMachine('v-ignore-scope');
  });

  it('absolute path (starting with ::) bypasses the VariableScope prefix', async () => {
    const mock = new MockCommLayer();

    function AbsoluteDisplay() {
      const [value] = useVariable<number>('::AsGlobalPV:Motor.Speed');
      return <span data-testid="value">{value ?? 'undef'}</span>;
    }

    render(
      <MachineProvider id="v-abs-path" machine={mock}>
        <VariableScope prefix="ShouldNotAppear">
          <AbsoluteDisplay />
        </VariableScope>
      </MachineProvider>,
    );

    await act(async () => {
      mock.setVariableValue('::AsGlobalPV:Motor.Speed', 99);
    });

    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('99'),
    );
    MachineRegistry.unregisterMachine('v-abs-path');
  });

  it('absolute path (starting with ns=) bypasses the VariableScope prefix', async () => {
    const mock = new MockCommLayer();

    function AbsoluteDisplay() {
      const [value] = useVariable<number>('ns=5;s=::AsGlobalPV:Motor.Speed');
      return <span data-testid="value">{value ?? 'undef'}</span>;
    }

    render(
      <MachineProvider id="v-ns-path" machine={mock}>
        <VariableScope prefix="ShouldNotAppear">
          <AbsoluteDisplay />
        </VariableScope>
      </MachineProvider>,
    );

    await act(async () => {
      mock.setVariableValue('ns=5;s=::AsGlobalPV:Motor.Speed', 33);
    });

    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('33'),
    );
    MachineRegistry.unregisterMachine('v-ns-path');
  });

  it('looks up machine by explicit machineId', async () => {
    const mock1 = new MockCommLayer();
    const mock2 = new MockCommLayer();

    render(
      <MachineProvider id="v-m1" machine={mock1}>
        <MachineProvider id="v-m2" machine={mock2}>
          <SpeedDisplay machineId="v-m1" />
        </MachineProvider>
      </MachineProvider>,
    );

    // Only mock1 pushes a value — the hook should receive it even though nested in mock2
    await act(async () => {
      mock1.setVariableValue('Motor.Speed', 777);
    });

    await waitFor(() =>
      expect(screen.getByTestId('value').textContent).toBe('777'),
    );
  });
});

function InvalidDisplay({ path = 'Motor.Speed' }: { path?: string }) {
  const [value, setValue, meta] = useVariable<number>(path);
  return (
    <div>
      <span data-testid="value">{value === null ? 'null' : (value ?? 'undef')}</span>
      <span data-testid="invalid">{String(meta.invalid)}</span>
      <span data-testid="error">{meta.error?.message ?? 'null'}</span>
      <button onClick={() => setValue(9999).catch(() => {})}>set</button>
    </div>
  );
}

describe('useVariable invalid flag', () => {
  it('starts as false', () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="inv-init" machine={mock}>
        <InvalidDisplay />
      </MachineProvider>,
    );
    expect(screen.getByTestId('invalid').textContent).toBe('false');
    MachineRegistry.unregisterMachine('inv-init');
  });

  it('remains false when a good-quality value arrives', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="inv-good" machine={mock}>
        <InvalidDisplay />
      </MachineProvider>,
    );

    await act(async () => {
      mock.setVariableValue('Motor.Speed', 42);
    });

    await waitFor(() =>
      expect(screen.getByTestId('invalid').textContent).toBe('false'),
    );
    MachineRegistry.unregisterMachine('inv-good');
  });

  it('sets invalid true when subscription delivers bad quality', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="inv-bad-qual" machine={mock}>
        <InvalidDisplay />
      </MachineProvider>,
    );

    // Establish the subscription by delivering an initial good value
    await act(async () => {
      mock.setVariableValue('Motor.Speed', 42);
    });
    await waitFor(() =>
      expect(screen.getByTestId('invalid').textContent).toBe('false'),
    );

    // Now fire a bad-quality event
    await act(async () => {
      mock.fireSubscriptionEvent('Motor.Speed', { value: 0, quality: 'bad' });
    });

    await waitFor(() =>
      expect(screen.getByTestId('invalid').textContent).toBe('true'),
    );
    MachineRegistry.unregisterMachine('inv-bad-qual');
  });

  it('sets invalid true when subscription delivers null value', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="inv-null-val" machine={mock}>
        <InvalidDisplay />
      </MachineProvider>,
    );

    // Establish the subscription by delivering an initial good value
    await act(async () => {
      mock.setVariableValue('Motor.Speed', 42);
    });
    await waitFor(() =>
      expect(screen.getByTestId('invalid').textContent).toBe('false'),
    );

    // Now fire a null-value event
    await act(async () => {
      mock.fireSubscriptionEvent('Motor.Speed', { value: null });
    });

    await waitFor(() =>
      expect(screen.getByTestId('invalid').textContent).toBe('true'),
    );
    MachineRegistry.unregisterMachine('inv-null-val');
  });

  it('clears invalid when a subsequent good value arrives', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="inv-recover" machine={mock}>
        <InvalidDisplay />
      </MachineProvider>,
    );

    // Establish the subscription and put it into an invalid state
    await act(async () => {
      mock.setVariableValue('Motor.Speed', 42);
    });
    await act(async () => {
      mock.fireSubscriptionEvent('Motor.Speed', { value: null });
    });
    await waitFor(() =>
      expect(screen.getByTestId('invalid').textContent).toBe('true'),
    );

    // Good value arrives — invalid should clear
    await act(async () => {
      mock.setVariableValue('Motor.Speed', 100);
    });
    await waitFor(() =>
      expect(screen.getByTestId('invalid').textContent).toBe('false'),
    );
    MachineRegistry.unregisterMachine('inv-recover');
  });

  it('sets invalid true when write fails with variable not found', async () => {
    const mock = new MockCommLayer();
    vi.spyOn(mock, 'writeVariable').mockRejectedValue(new Error('Variable not found on server'));

    render(
      <MachineProvider id="inv-write-notfound" machine={mock}>
        <InvalidDisplay />
      </MachineProvider>,
    );

    await act(async () => {
      screen.getByText('set').click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('invalid').textContent).toBe('true'),
    );
    MachineRegistry.unregisterMachine('inv-write-notfound');
  });

  it('does NOT set invalid when write fails for other reasons', async () => {
    const mock = new MockCommLayer();
    vi.spyOn(mock, 'writeVariable').mockRejectedValue(new Error('permission denied'));

    render(
      <MachineProvider id="inv-write-perm" machine={mock}>
        <InvalidDisplay />
      </MachineProvider>,
    );

    await act(async () => {
      screen.getByText('set').click();
    });

    await waitFor(() =>
      expect(screen.getByTestId('error').textContent).toBe('permission denied'),
    );
    expect(screen.getByTestId('invalid').textContent).toBe('false');
    MachineRegistry.unregisterMachine('inv-write-perm');
  });
});
