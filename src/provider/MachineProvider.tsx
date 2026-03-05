import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MachineContext } from '../context/MachineContext';
import { VariableScopeContext } from '../context/VariableScopeContext';
import { MachineRegistry } from '../registry/MachineRegistry';
import type { MachineContextValue } from '../registry/MachineRegistry';
import { SubscriptionManager } from '../subscription/SubscriptionManager';
import type { ICommLayer } from '../types/ICommLayer';
import type { ConnectionState } from '../types/ConnectionState';
import type { ReadGroupConfig } from '../types/VariableTypes';

export interface MachineProviderProps {
  id: string;
  commLayer: ICommLayer;
  alwaysRead?: string[];
  readGroups?: ReadGroupConfig[];
  variablePrefix?: string;
  children: React.ReactNode;
}

/**
 * Provides a machine connection to a React subtree.
 *
 * - Calls commLayer.connect() on mount and commLayer.disconnect() on unmount.
 * - Creates a SubscriptionManager scoped to this provider.
 * - Registers with MachineRegistry so cross-tree lookup works by id.
 * - Subscribes alwaysRead[] paths for the lifetime of the provider.
 * - Sets VariableScopeContext to variablePrefix (root namespace for path resolution).
 */
export function MachineProvider({
  id,
  commLayer,
  alwaysRead,
  variablePrefix = '',
  children,
}: MachineProviderProps): React.JSX.Element {
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    commLayer.connectionState,
  );

  // Stable SubscriptionManager — recreated only when commLayer changes
  const smRef = useRef<SubscriptionManager | null>(null);
  if (smRef.current === null) {
    smRef.current = new SubscriptionManager(commLayer);
  }
  const subscriptionManager = smRef.current;

  // Build context value (stable ref so registry always has the latest)
  const contextValue: MachineContextValue = {
    machineId: id,
    connectionState,
    commLayer,
    subscriptionManager,
  };
  const contextValueRef = useRef<MachineContextValue>(contextValue);
  contextValueRef.current = contextValue;

  // Register synchronously on first render so children can look up this machine
  // by id immediately (React renders parent before children).
  const isRegisteredRef = useRef(false);
  if (!isRegisteredRef.current) {
    isRegisteredRef.current = true;
    MachineRegistry.registerMachine(id, contextValue);
  }

  // Keep registry in sync when connectionState or id changes
  useLayoutEffect(() => {
    MachineRegistry.updateMachine(id, contextValueRef.current);
  });

  // Unregister on unmount (or id change → re-register)
  useEffect(() => {
    return () => {
      isRegisteredRef.current = false;
      MachineRegistry.unregisterMachine(id);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Connection lifecycle
  useEffect(() => {
    const unsubState = commLayer.onConnectionStateChanged((state) => {
      setConnectionState(state);
    });

    commLayer.connect().catch(() => {
      // Connection errors are surfaced via connectionState (→ ERROR)
    });

    return () => {
      unsubState();
      commLayer.disconnect().catch(() => {});
      subscriptionManager.destroy();
    };
  // commLayer is intentionally not in deps — it's treated as stable for the
  // provider lifetime.  If a new commLayer is passed, remount the provider.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // alwaysRead subscriptions — noop callbacks; kept alive for value cache
  const alwaysReadRef = useRef<string[]>([]);
  useEffect(() => {
    const noop = () => {};
    const paths = alwaysRead ?? [];

    // Remove old paths
    for (const path of alwaysReadRef.current) {
      if (!paths.includes(path)) {
        subscriptionManager.removeDesired(path, noop);
      }
    }
    // Add new paths
    for (const path of paths) {
      if (!alwaysReadRef.current.includes(path)) {
        subscriptionManager.addDesired(path, noop);
      }
    }
    alwaysReadRef.current = paths;

    return () => {
      for (const path of paths) {
        subscriptionManager.removeDesired(path, noop);
      }
    };
    // Re-run when alwaysRead array identity or length changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alwaysRead?.join(',')]);

  return (
    <MachineContext.Provider value={contextValue}>
      <VariableScopeContext.Provider value={variablePrefix}>
        {children}
      </VariableScopeContext.Provider>
    </MachineContext.Provider>
  );
}
