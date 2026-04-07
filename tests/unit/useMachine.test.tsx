import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, waitFor, cleanup } from '@testing-library/react';
import { MachineProvider } from '../../src/provider/MachineProvider';
import { MockCommLayer } from '../../src/mock/MockCommLayer';
import { useMachine } from '../../src/hooks/useMachine';
import { ConnectionState } from '../../src/types/ConnectionState';

function MachineDisplay({ machineId }: { machineId?: string }) {
  const machine = useMachine(machineId);
  return (
    <div>
      <span data-testid="state">{machine.connectionState}</span>
      <span data-testid="id">{machine.machineId}</span>
      {machine.changeUser && <span data-testid="has-change-user">yes</span>}
      {machine.writeMany && <span data-testid="has-write-many">yes</span>}
    </div>
  );
}

describe('useMachine', () => {
  // RTL auto-cleanup unmounts components after each test, which triggers
  // MachineProvider's useEffect cleanup to unregister from MachineRegistry.
  afterEach(() => cleanup());

  it('returns connection state from nearest provider', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="press1" machine={mock}>
        <MachineDisplay />
      </MachineProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId('state').textContent).toBe(ConnectionState.CONNECTED),
    );
  });

  it('returns machineId', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="press1" machine={mock}>
        <MachineDisplay />
      </MachineProvider>,
    );
    expect(screen.getByTestId('id').textContent).toBe('press1');
  });

  it('updates when connection state changes', async () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="press1" machine={mock}>
        <MachineDisplay />
      </MachineProvider>,
    );

    await act(async () => {
      mock.simulateConnectionState(ConnectionState.ERROR);
    });

    expect(screen.getByTestId('state').textContent).toBe(ConnectionState.ERROR);
  });

  it('throws when used outside any provider', () => {
    // Suppress React error boundaries noise in test output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<MachineDisplay />)).toThrow();
    consoleSpy.mockRestore();
  });

  it('looks up machine by id from registry', () => {
    const mock1 = new MockCommLayer();
    const mock2 = new MockCommLayer();

    function Cross() {
      return <MachineDisplay machineId="m1" />;
    }

    render(
      <MachineProvider id="m1" machine={mock1}>
        <MachineProvider id="m2" machine={mock2}>
          <Cross />
        </MachineProvider>
      </MachineProvider>,
    );

    // Should return m1 even though m2 is nearest
    expect(screen.getByTestId('id').textContent).toBe('m1');
    // Cleanup handled by afterEach
  });

  it('does not expose changeUser when commLayer does not implement it', () => {
    const mock = new MockCommLayer();
    render(
      <MachineProvider id="test-cu" machine={mock}>
        <MachineDisplay />
      </MachineProvider>,
    );
    expect(screen.queryByTestId('has-change-user')).toBeNull();
  });

  it('exposes changeUser when commLayer implements it', () => {
    const mock = new MockCommLayer() as MockCommLayer & {
      changeUser(u: string, p: string): Promise<void>;
    };
    mock.changeUser = vi.fn().mockResolvedValue(undefined);

    render(
      <MachineProvider id="test-cu2" machine={mock}>
        <MachineDisplay />
      </MachineProvider>,
    );
    expect(screen.getByTestId('has-change-user').textContent).toBe('yes');
  });
});
