import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MachineProvider } from '../../src/provider/MachineProvider';
import { MockCommLayer } from '../../src/mock/MockCommLayer';
import { ConnectionState } from '../../src/types/ConnectionState';
import { useMachineContext } from '../../src/context/MachineContext';
import { useVariablePrefix } from '../../src/context/VariableScopeContext';
import { MachineRegistry } from '../../src/registry/MachineRegistry';

// Helper component to read context
function ContextReader({
  onContext,
}: {
  onContext: (ctx: ReturnType<typeof useMachineContext>) => void;
}) {
  const ctx = useMachineContext();
  onContext(ctx);
  return null;
}

function PrefixReader({ onPrefix }: { onPrefix: (p: string) => void }) {
  const prefix = useVariablePrefix();
  onPrefix(prefix);
  return null;
}

describe('MachineProvider', () => {
  let mock: MockCommLayer;

  beforeEach(() => {
    mock = new MockCommLayer();
  });

  afterEach(() => {
    // Clean up registry between tests
    MachineRegistry.unregisterMachine('test');
    MachineRegistry.unregisterMachine('machine1');
    MachineRegistry.unregisterMachine('machine2');
  });

  it('calls connect() on mount', async () => {
    const connectSpy = vi.spyOn(mock, 'connect');
    render(
      <MachineProvider id="test" commLayer={mock}>
        <div />
      </MachineProvider>,
    );
    await waitFor(() => expect(connectSpy).toHaveBeenCalledOnce());
  });

  it('calls disconnect() on unmount', async () => {
    const disconnectSpy = vi.spyOn(mock, 'disconnect');
    const { unmount } = render(
      <MachineProvider id="test" commLayer={mock}>
        <div />
      </MachineProvider>,
    );
    await act(async () => {
      unmount();
    });
    expect(disconnectSpy).toHaveBeenCalledOnce();
  });

  it('provides machineId and commLayer via context', async () => {
    let ctx: ReturnType<typeof useMachineContext> = null;
    render(
      <MachineProvider id="test" commLayer={mock}>
        <ContextReader onContext={(c) => { ctx = c; }} />
      </MachineProvider>,
    );
    expect(ctx?.machineId).toBe('test');
    expect(ctx?.commLayer).toBe(mock);
  });

  it('updates connectionState in context when commLayer state changes', async () => {
    let ctx: ReturnType<typeof useMachineContext> = null;
    render(
      <MachineProvider id="test" commLayer={mock}>
        <ContextReader onContext={(c) => { ctx = c; }} />
      </MachineProvider>,
    );

    await act(async () => {
      mock.simulateConnectionState(ConnectionState.ERROR);
    });

    expect(ctx?.connectionState).toBe(ConnectionState.ERROR);
  });

  it('sets variablePrefix on VariableScopeContext', () => {
    let prefix = '';
    render(
      <MachineProvider id="test" commLayer={mock} variablePrefix="::AsGlobalPV:">
        <PrefixReader onPrefix={(p) => { prefix = p; }} />
      </MachineProvider>,
    );
    expect(prefix).toBe('::AsGlobalPV:');
  });

  it('subscribes alwaysRead paths on mount', async () => {
    render(
      <MachineProvider id="test" commLayer={mock} alwaysRead={['Heartbeat', 'MachineStatus']}>
        <div />
      </MachineProvider>,
    );
    await act(async () => {});  // flush microtasks
    expect(mock.getSubscribedPaths()).toEqual(
      expect.arrayContaining(['Heartbeat', 'MachineStatus']),
    );
  });

  it('registers with MachineRegistry', () => {
    render(
      <MachineProvider id="machine1" commLayer={mock}>
        <div />
      </MachineProvider>,
    );
    expect(MachineRegistry.getMachineById('machine1')).toBeDefined();
    expect(MachineRegistry.getMachineById('machine1')?.machineId).toBe('machine1');
  });

  it('unregisters from MachineRegistry on unmount', async () => {
    const { unmount } = render(
      <MachineProvider id="machine1" commLayer={mock}>
        <div />
      </MachineProvider>,
    );
    await act(async () => { unmount(); });
    expect(MachineRegistry.getMachineById('machine1')).toBeUndefined();
  });
});
