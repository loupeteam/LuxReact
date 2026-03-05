import type { ConnectionState } from '../types/ConnectionState';
import type { ICommLayer } from '../types/ICommLayer';
import type { SubscriptionManager } from '../subscription/SubscriptionManager';

/**
 * The value stored per machine in the registry — and surfaced via MachineContext.
 * Consumers cast optionally-present commLayer methods through to MachineControls.
 */
export interface MachineContextValue {
  machineId: string;
  connectionState: ConnectionState;
  commLayer: ICommLayer;
  subscriptionManager: SubscriptionManager;
}

type MachineListener = () => void;

/**
 * Module-level singleton registry.
 *
 * MachineProvider registers on mount and unregisters on unmount.
 * Hooks use getMachineById() for cross-tree machine lookups.
 * subscribe() lets hooks re-render when a specific machine's state changes.
 */
class MachineRegistryImpl {
  private _machines = new Map<string, MachineContextValue>();
  private _listeners = new Map<string, Set<MachineListener>>();

  registerMachine(id: string, value: MachineContextValue): void {
    this._machines.set(id, value);
    this._notify(id);
  }

  updateMachine(id: string, partial: Partial<MachineContextValue>): void {
    const existing = this._machines.get(id);
    if (!existing) return;
    this._machines.set(id, { ...existing, ...partial });
    this._notify(id);
  }

  unregisterMachine(id: string): void {
    this._machines.delete(id);
    this._notify(id);
  }

  getMachineById(id: string): MachineContextValue | undefined {
    return this._machines.get(id);
  }

  /**
   * Subscribe to changes for a specific machine id.
   * Returns an unsubscribe function.
   */
  subscribe(id: string, listener: MachineListener): () => void {
    if (!this._listeners.has(id)) {
      this._listeners.set(id, new Set());
    }
    this._listeners.get(id)!.add(listener);
    return () => {
      this._listeners.get(id)?.delete(listener);
    };
  }

  private _notify(id: string): void {
    const listeners = this._listeners.get(id);
    if (listeners) {
      for (const listener of listeners) {
        listener();
      }
    }
  }
}

export const MachineRegistry = new MachineRegistryImpl();
