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

    // Optimistic update should show 9999 immediately
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

    MachineRegistry.unregisterMachine('v-m1');
    MachineRegistry.unregisterMachine('v-m2');
  });
});
