import { useCallback } from 'react';
import { useResolvedContext } from './useResolvedContext';
import { useVariablePrefix, resolvePath } from '../context/VariableScopeContext';

/**
 * Write-only hook. Creates no subscription and produces no re-renders from PLC updates.
 *
 * @param path      Variable path (resolved against nearest VariableScope prefix)
 * @param machineId Optional: target a specific machine by id
 *
 * @returns An async write function
 */
export function useWrite<T = unknown>(
  path: string,
  machineId?: string,
): (value: T) => Promise<void> {
  const context = useResolvedContext(machineId);
  const prefix = useVariablePrefix();
  const resolvedPath = resolvePath(path, prefix);

  const write = useCallback(
    async (value: T): Promise<void> => {
      if (!context) {
        throw new Error(`[lux-react] useWrite: no machine context for path "${resolvedPath}"`);
      }
      await context.commLayer.writeVariable(resolvedPath, value);
    },
    [context, resolvedPath],
  );

  return write;
}
