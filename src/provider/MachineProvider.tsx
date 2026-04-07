import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MachineContext } from '../context/MachineContext';
import { VariableScopeContext } from '../context/VariableScopeContext';
import { MachineRegistry } from '../registry/MachineRegistry';
import type { MachineContextValue } from '../registry/MachineRegistry';
import { SubscriptionManager } from '../subscription/SubscriptionManager';
import type { ICommLayer } from '../types/ICommLayer';
import type { ConnectionState } from '../types/ConnectionState';
import type { ReadGroupConfig, VariableChangeCallback } from '../types/VariableTypes';

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

  // Register synchronously on first render so children can look up this machine
  // by id immediately (React renders parent before children).
  const isRegisteredRef = useRef(false);
  if (!isRegisteredRef.current) {
    isRegisteredRef.current = true;
    MachineRegistry.registerMachine(id, contextValue);
  }

  // Keep registry in sync only when registry-visible values actually change.
  useLayoutEffect(() => {
    MachineRegistry.updateMachine(id, {
      machineId: id,
      connectionState,
      commLayer,
      subscriptionManager,
    });
  }, [id, connectionState, commLayer, subscriptionManager]);

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

  // alwaysRead subscriptions — stable callback identity and explicit set reconciliation
  const alwaysReadCallbackRef = useRef<VariableChangeCallback>(() => {});
  const alwaysReadRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const callback = alwaysReadCallbackRef.current;
    const nextPaths = new Set(alwaysRead ?? []);
    const prevPaths = alwaysReadRef.current;

    for (const path of prevPaths) {
      if (!nextPaths.has(path)) {
        subscriptionManager.removeDesired(path, callback);
      }
    }

    for (const path of nextPaths) {
      if (!prevPaths.has(path)) {
        subscriptionManager.addDesired(path, callback);
      }
    }

    alwaysReadRef.current = nextPaths;
  }, [alwaysRead, subscriptionManager]);

  // Remove currently tracked alwaysRead paths on unmount.
  useEffect(() => {
    return () => {
      const callback = alwaysReadCallbackRef.current;
      for (const path of alwaysReadRef.current) {
        subscriptionManager.removeDesired(path, callback);
      }
    };
  }, [subscriptionManager]);

  return (
    <MachineContext.Provider value={contextValue}>
      <VariableScopeContext.Provider value={variablePrefix}>
        {children}
      </VariableScopeContext.Provider>
    </MachineContext.Provider>
  );
}
