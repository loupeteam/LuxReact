import { useCallback, useEffect, useRef, useState } from 'react';
import { useResolvedContext } from './useResolvedContext';
import { useVariablePrefix, resolvePath } from '../context/VariableScopeContext';
import type { VariableConfig, VariableMeta, VariableChangeEvent } from '../types/VariableTypes';
import { ConnectionState } from '../types/ConnectionState';

const DEFAULT_META: VariableMeta = {
  connectionState: ConnectionState.DISCONNECTED,
  timestamp: null,
  quality: null,
  loading: true,
  error: null,
};

/**
 * Subscribe to a PLC variable.
 *
 * @param path      Variable path (resolved against nearest VariableScope prefix)
 * @param options   Optional config: defaultValue, optimistic, samplingInterval, publishingInterval
 * @param machineId Optional: target a specific machine by id (bypasses nearest provider)
 *
 * @returns [value, setValue, meta]
 */
export function useVariable<T = unknown>(
  path: string,
  options?: VariableConfig<T>,
  machineId?: string,
): [T | undefined, (value: T) => Promise<void>, VariableMeta] {
  const context = useResolvedContext(machineId);
  const prefix = useVariablePrefix();
  // Bypass the scope when explicitly requested, or when the path is already
  // absolute (starts with '::' for B&R PV paths or 'ns=' for OPC UA syntax).
  const isAbsolute = path.startsWith('::') || path.startsWith('ns=');
  const effectivePrefix = (isAbsolute || options?.ignoreScope) ? '' : prefix;
  const resolvedPath = resolvePath(path, effectivePrefix);

  const [value, setValue] = useState<T | undefined>(options?.defaultValue);
  const [meta, setMeta] = useState<VariableMeta>({
    ...DEFAULT_META,
    connectionState: context?.connectionState ?? ConnectionState.DISCONNECTED,
  });

  // callbackRef pattern — subscription effect does not re-run when options/value change
  const callbackRef = useRef<(event: VariableChangeEvent) => void>(() => {});
  callbackRef.current = (event: VariableChangeEvent) => {
    setValue(event.value as T);
    setMeta({
      connectionState: context?.connectionState ?? ConnectionState.DISCONNECTED,
      timestamp: event.timestamp,
      quality: event.quality,
      loading: false,
      error: null,
    });
  };

  // Subscribe/unsubscribe when resolved path or machine changes
  useEffect(() => {
    if (!context) return;
    const { subscriptionManager } = context;
    const stableCallback = (event: VariableChangeEvent) => callbackRef.current(event);

    const subscribeOptions: import('../types/VariableTypes').SubscribeOptions = {};
    if (options?.readGroupName !== undefined) subscribeOptions.readGroupName = options.readGroupName;
    if (options?.samplingInterval !== undefined) subscribeOptions.samplingInterval = options.samplingInterval;
    if (options?.publishingInterval !== undefined) subscribeOptions.publishingInterval = options.publishingInterval;
    subscriptionManager.addDesired(resolvedPath, stableCallback, subscribeOptions);

    return () => {
      subscriptionManager.removeDesired(resolvedPath, stableCallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPath, machineId, context?.machineId]);

  // Update connectionState in meta when it changes
  useEffect(() => {
    if (!context) return;
    setMeta(prev => ({ ...prev, connectionState: context.connectionState }));
  }, [context?.connectionState]);

  const writeValue = useCallback(
    async (newValue: T): Promise<void> => {
      if (!context) throw new Error(`[lux-react] useVariable: no machine context for path "${resolvedPath}"`);

      const preOptimisticValue = value;

      if (options?.optimistic) {
        setValue(newValue);
      }

      try {
        await context.commLayer.writeVariable(resolvedPath, newValue);
      } catch (err) {
        // Read the actual server value so the UI reflects the true PLC state
        // regardless of whether we were in optimistic mode or not.
        try {
          const actual = await context.commLayer.readVariable(resolvedPath);
          setValue(actual as T);
        } catch {
          // Read failed too (e.g. disconnected) — fall back to pre-write snapshot
          if (options?.optimistic) {
            setValue(preOptimisticValue);
          }
        }
        setMeta(prev => ({
          ...prev,
          error: err instanceof Error ? err : new Error(String(err)),
        }));
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedPath, context, options?.optimistic, value],
  );

  return [value, writeValue, meta];
}
