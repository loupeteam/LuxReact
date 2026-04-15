import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MachineProvider } from '../../src/provider/MachineProvider';
import { MockCommLayer } from '../../src/mock/MockCommLayer';
import { useVariable } from '../../src/hooks/useVariable';
import { useParent } from '../../src/hooks/useParent';
import { cleanup } from '@testing-library/react';

// -------------------------------------------------------------------------
// Components
// -------------------------------------------------------------------------

function SpeedDisplay({ machineId }: { machineId?: string }) {
  const [speed] = useVariable<number>('Motor.Speed', {}, machineId);
  return <span data-testid={`speed-${machineId ?? 'nearest'}`}>{speed ?? 'none'}</span>;
}

function TempDisplay({ machineId }: { machineId?: string }) {
  const [temp] = useVariable<number>('Motor.Temp', {}, machineId);
  return <span data-testid={`temp-${machineId ?? 'nearest'}`}>{temp ?? 'none'}</span>;
}

function MotorPanel({ machineId }: { machineId?: string }) {
  useParent('Motor', { mode: 'onDemand', machineId });
  return (
    <div>
      <SpeedDisplay machineId={machineId} />
      <TempDisplay machineId={machineId} />
    </div>
  );
}

function ComparisonView() {
  return (
    <div>
      <SpeedDisplay machineId="cmp1" />
      <SpeedDisplay machineId="cmp2" />
    </div>
  );
}

// -------------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------------

describe('MultiProvider integration', () => {
  afterEach(() => cleanup());

  it('two providers do not share desired paths or values', async () => {
    const mock1 = new MockCommLayer();
    const mock2 = new MockCommLayer();

    render(
      <MachineProvider id="mp1" machine={mock1}>
        <MachineProvider id="mp2" machine={mock2}>
          <div>
            {/* nearest to SpeedDisplay is mp2 */}
            <SpeedDisplay />
          </div>
        </MachineProvider>
      </MachineProvider>,
    );

    await act(async () => {
      mock1.setVariableValue('Motor.Speed', 111);
      mock2.setVariableValue('Motor.Speed', 222);
    });

    await waitFor(() =>
      expect(screen.getByTestId('speed-nearest').textContent).toBe('222'),
    );

    // mock1's subscription should not have received mp2's desired path
    expect(mock1.getSubscribedPaths()).not.toContain('Motor.Speed');

  });

  it('cross-tree id lookup delivers correct values independently', async () => {
    const mock1 = new MockCommLayer();
    const mock2 = new MockCommLayer();

    render(
      <MachineProvider id="cmp1" machine={mock1}>
        <MachineProvider id="cmp2" machine={mock2}>
          <ComparisonView />
        </MachineProvider>
      </MachineProvider>,
    );

    await act(async () => {
      mock1.setVariableValue('Motor.Speed', 300);
      mock2.setVariableValue('Motor.Speed', 400);
    });

    await waitFor(() => {
      expect(screen.getByTestId('speed-cmp1').textContent).toBe('300');
      expect(screen.getByTestId('speed-cmp2').textContent).toBe('400');
    });

  });

  it('useParent optimization is scoped to the correct provider', async () => {
    const mock1 = new MockCommLayer();
    const mock2 = new MockCommLayer();

    render(
      <MachineProvider id="mp-opt1" machine={mock1}>
        <MachineProvider id="mp-opt2" machine={mock2}>
          <MotorPanel machineId="mp-opt1" />
        </MachineProvider>
      </MachineProvider>,
    );

    // mock1 should have Motor subscribed (not mock2)
    await act(async () => {});
    expect(mock1.getSubscribedPaths()).toContain('Motor');
    expect(mock2.getSubscribedPaths()).not.toContain('Motor');

    // Fan-out delivers child values from mock1
    await act(async () => {
      mock1.setVariableValue('Motor', { Speed: 50, Temp: 25 });
    });

    await waitFor(() => {
      expect(screen.getByTestId('speed-mp-opt1').textContent).toBe('50');
      expect(screen.getByTestId('temp-mp-opt1').textContent).toBe('25');
    });

  });
});
