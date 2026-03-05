import { useEffect, useRef, useSyncExternalStore } from 'react';
import { MachineRegistry } from '../registry/MachineRegistry';
import type { MachineContextValue } from '../registry/MachineRegistry';
import { useMachineContext } from '../context/MachineContext';

/**
 * Resolves the MachineContextValue to use for a hook.
 *
 * Resolution order:
 *  1. If `machineId` is provided, look up the machine in MachineRegistry.
 *  2. Otherwise, use the nearest MachineContext (nearest MachineProvider in the tree).
 *
 * Returns null if no machine is found (e.g., hook is outside any provider and no id given).
 * Subscribes to registry updates so the hook re-renders on connection state changes.
 */
export function useResolvedContext(machineId?: string): MachineContextValue | null {
  const nearestContext = useMachineContext();

  // Stable ref to avoid re-subscribing when machineId doesn't change
  const machineIdRef = useRef(machineId);
  useEffect(() => {
    machineIdRef.current = machineId;
  });

  const registryValue = useSyncExternalStore(
    (onStoreChange) => {
      if (!machineId) return () => {};
      return MachineRegistry.subscribe(machineId, onStoreChange);
    },
    () => {
      if (!machineId) return null;
      return MachineRegistry.getMachineById(machineId) ?? null;
    },
  );

  if (machineId !== undefined) {
    return registryValue;
  }

  return nearestContext;
}
