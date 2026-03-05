import { createContext, useContext } from 'react';
import type { MachineContextValue } from '../registry/MachineRegistry';

export const MachineContext = createContext<MachineContextValue | null>(null);

/**
 * Returns the nearest MachineContext value, or null if outside any MachineProvider.
 * Hooks use this to get the contextual machine without needing an explicit machineId.
 */
export function useMachineContext(): MachineContextValue | null {
  return useContext(MachineContext);
}
