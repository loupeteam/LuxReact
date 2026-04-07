import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MachineRegistry, type MachineContextValue } from '../../src/registry/MachineRegistry';
import { ConnectionState } from '../../src/types/ConnectionState';

function makeValue(overrides?: Partial<MachineContextValue>): MachineContextValue {
  const base = {
    machineId: 'm-reg',
    connectionState: ConnectionState.CONNECTED,
    commLayer: {} as MachineContextValue['commLayer'],
    subscriptionManager: {} as MachineContextValue['subscriptionManager'],
  };

  return {
    ...base,
    ...overrides,
  };
}

describe('MachineRegistry', () => {
  beforeEach(() => {
    MachineRegistry.unregisterMachine('m-reg');
  });

  it('does not notify listeners for redundant updateMachine calls', () => {
    const listener = vi.fn();
    const value = makeValue();

    const unsubscribe = MachineRegistry.subscribe('m-reg', listener);
    MachineRegistry.registerMachine('m-reg', value);
    expect(listener).toHaveBeenCalledTimes(1);

    MachineRegistry.updateMachine('m-reg', {
      machineId: 'm-reg',
      connectionState: ConnectionState.CONNECTED,
      commLayer: value.commLayer,
      subscriptionManager: value.subscriptionManager,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('notifies listeners when a registry-visible value changes', () => {
    const listener = vi.fn();
    const unsubscribe = MachineRegistry.subscribe('m-reg', listener);

    MachineRegistry.registerMachine('m-reg', makeValue());
    expect(listener).toHaveBeenCalledTimes(1);

    MachineRegistry.updateMachine('m-reg', {
      connectionState: ConnectionState.ERROR,
    });

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
  });

  it('does not notify when unregistering a machine that is not present', () => {
    const listener = vi.fn();
    const unsubscribe = MachineRegistry.subscribe('m-reg', listener);

    MachineRegistry.unregisterMachine('m-reg');
    expect(listener).not.toHaveBeenCalled();

    unsubscribe();
  });
});
