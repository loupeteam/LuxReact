/**
 * LuxConnectAdapter — bridges OpcuaMachine (lux-opcua) to ICommLayer (lux-react).
 *
 * Key bridge concerns:
 *  - OpcuaMachine.subscribe() is ASYNC (Promise<string>); ICommLayer.subscribe() must
 *    return a handle synchronously. Solved via the pending-map pattern.
 *  - OpcuaMachine.onConnectionStateChanged() returns void; ICommLayer requires an
 *    UnsubscribeFn. Solved by maintaining our own handler set.
 *  - OpcuaMachine.subscribe() callback receives only the raw value; VariableChangeCallback
 *    expects a full VariableChangeEvent. Adapter constructs the event.
 */

import { OpcuaMachine } from 'lux-opcua';
import type { ConnectionConfig } from 'lux-opcua';
import { ConnectionState } from 'lux-react';
import type {
  ICommLayer,
  SubscriptionHandle,
  UnsubscribeFn,
  VariableChangeCallback,
  ConnectionStateHandler,
  SubscribeOptions,
} from 'lux-react';

interface PendingEntry {
  cancelled: boolean;
  resolvedHandle: string | null;
}

export class LuxConnectAdapter implements ICommLayer {
  private readonly _machine: OpcuaMachine;
  private _nextHandle = 1;
  private readonly _pending = new Map<number, PendingEntry>();
  private _connectionState: ConnectionState;
  private readonly _stateHandlers = new Set<ConnectionStateHandler>();
  private _stateListenerRegistered = false;

  constructor(config: ConnectionConfig) {
    this._machine = new OpcuaMachine(config);
    // OpcuaMachine starts disconnected
    this._connectionState = ConnectionState.DISCONNECTED;
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  connect(): Promise<void> {
    return this._machine.connect();
  }

  disconnect(): Promise<void> {
    return this._machine.disconnect();
  }

  readVariable(path: string): Promise<unknown> {
    return this._machine.readVariable(path);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeVariable(path: string, value: unknown): Promise<void> {
    return this._machine.writeVariable(path, value as any);
  }

  /**
   * Returns a local integer handle synchronously.
   * The OpcuaMachine.subscribe() call happens asynchronously in the background.
   */
  subscribe(path: string, callback: VariableChangeCallback, options?: SubscribeOptions): SubscriptionHandle {
    const localHandle = this._nextHandle++;
    const entry: PendingEntry = { cancelled: false, resolvedHandle: null };
    this._pending.set(localHandle, entry);

    const samplingInterval = options?.samplingInterval ?? 100;

    this._machine
      .subscribe(
        path,
        (value) => {
          callback({ path, value, timestamp: new Date(), quality: 'good' });
        },
        samplingInterval,
      )
      .then((resolvedHandle) => {
        if (entry.cancelled) {
          // unsubscribe() was already called — clean up the real handle immediately
          void this._machine.unsubscribe(resolvedHandle);
        } else {
          entry.resolvedHandle = resolvedHandle;
        }
      })
      .catch(() => {
        // subscribe failed — mark cancelled so any later unsubscribe() is a no-op
        entry.cancelled = true;
      });

    return localHandle;
  }

  unsubscribe(handle: SubscriptionHandle): void {
    const localHandle = handle as number;
    const entry = this._pending.get(localHandle);
    if (!entry) return;

    entry.cancelled = true;
    this._pending.delete(localHandle);

    if (entry.resolvedHandle !== null) {
      void this._machine.unsubscribe(entry.resolvedHandle);
    }
    // If still pending, the .then() above will call unsubscribe when it resolves
  }

  /**
   * OpcuaMachine.onConnectionStateChanged() returns void, so we register a single
   * internal listener on first call and fan out to our own set of handlers.
   */
  onConnectionStateChanged(handler: ConnectionStateHandler): UnsubscribeFn {
    if (!this._stateListenerRegistered) {
      this._stateListenerRegistered = true;
      this._machine.onConnectionStateChanged((state) => {
        // lux-opcua uses lowercase values ('connected'); lux-react uses uppercase ('CONNECTED').
        this._connectionState = this._mapState(String(state));
        this._stateHandlers.forEach((h) => h(this._connectionState));
      });
    }
    this._stateHandlers.add(handler);
    return () => { this._stateHandlers.delete(handler); };
  }

  private _mapState(state: string): ConnectionState {
    const map: Record<string, ConnectionState> = {
      connected:     ConnectionState.CONNECTED,
      connecting:    ConnectionState.CONNECTING,
      disconnected:  ConnectionState.DISCONNECTED,
      disconnecting: ConnectionState.DISCONNECTING,
      reconnecting:  ConnectionState.RECONNECTING,
      error:         ConnectionState.ERROR,
    };
    return map[state.toLowerCase()] ?? ConnectionState.DISCONNECTED;
  }
}
