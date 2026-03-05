/**
 * LuxConnectAdapter — Reference adapter bridging LuxConnect's OpcuaMachine to ICommLayer.
 *
 * LuxConnect's OpcuaMachine.subscribe() is ASYNC (returns Promise<handle>), but
 * ICommLayer.subscribe() must be SYNCHRONOUS (returns a handle immediately) because
 * React useEffect cleanup calls unsubscribe() synchronously.
 *
 * Bridge strategy:
 *  1. Return a local integer handle immediately.
 *  2. Store a {cancelled, resolvedHandle} entry in a pending map.
 *  3. When the async subscribe resolves:
 *     - If not cancelled → store the resolved handle.
 *     - If cancelled      → call machine.unsubscribe(resolvedHandle) immediately.
 *  4. unsubscribe(localHandle): set cancelled=true; if already resolved, call
 *     machine.unsubscribe(resolvedHandle) right away.
 *
 * This file is a reference example, NOT part of the lux-react library bundle.
 * Copy and adapt it in any project that uses LuxConnect.
 */

import { ConnectionState } from '../src/types/ConnectionState';
import type { ICommLayer } from '../src/types/ICommLayer';
import type {
  SubscriptionHandle,
  UnsubscribeFn,
  VariableChangeCallback,
  ConnectionStateHandler,
  SubscribeOptions,
} from '../src/types/VariableTypes';

// ---------------------------------------------------------------------------
// Minimal interface for OpcuaMachine — avoids importing lux-opcua directly.
// Replace with the actual import in a real project.
// ---------------------------------------------------------------------------
interface OpcuaMachine {
  connectionState: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  readVariable(path: string): Promise<unknown>;
  writeVariable(path: string, value: unknown): Promise<void>;
  subscribe(
    path: string,
    callback: (event: { value: unknown; timestamp: Date; quality: string }) => void,
    options?: { samplingInterval?: number; publishingInterval?: number },
  ): Promise<unknown>;  // returns an opaque handle
  unsubscribe(handle: unknown): Promise<void>;
  onConnectionStateChange(handler: (state: string) => void): () => void;
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

interface PendingSubscription {
  cancelled: boolean;
  resolvedHandle: unknown | null;
}

export class LuxConnectAdapter implements ICommLayer {
  private _machine: OpcuaMachine;
  private _nextHandle = 1;
  private _pending = new Map<number, PendingSubscription>();
  private _connectionState: ConnectionState = ConnectionState.DISCONNECTED;

  constructor(machine: OpcuaMachine) {
    this._machine = machine;
    this._connectionState = this._mapState(machine.connectionState);
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

  writeVariable(path: string, value: unknown): Promise<void> {
    return this._machine.writeVariable(path, value);
  }

  // Synchronous handle; async setup happens internally.
  subscribe(
    path: string,
    callback: VariableChangeCallback,
    options?: SubscribeOptions,
  ): SubscriptionHandle {
    const localHandle = this._nextHandle++;
    const entry: PendingSubscription = { cancelled: false, resolvedHandle: null };
    this._pending.set(localHandle, entry);

    this._machine
      .subscribe(
        path,
        (event) => {
          callback({
            path,
            value: event.value,
            timestamp: event.timestamp,
            quality: this._mapQuality(event.quality),
          });
        },
        {
          samplingInterval: options?.samplingInterval,
          publishingInterval: options?.publishingInterval,
        },
      )
      .then((resolvedHandle) => {
        if (entry.cancelled) {
          // Unsubscribe was already called — clean up the real handle immediately
          void this._machine.unsubscribe(resolvedHandle);
        } else {
          entry.resolvedHandle = resolvedHandle;
        }
      })
      .catch(() => {
        // Subscribe failed — mark as cancelled so any subsequent unsubscribe is a no-op
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
      // Already resolved — unsubscribe immediately
      void this._machine.unsubscribe(entry.resolvedHandle);
    }
    // If still pending, the .then() above will call unsubscribe when it resolves
  }

  onConnectionStateChanged(handler: ConnectionStateHandler): UnsubscribeFn {
    return this._machine.onConnectionStateChange((state) => {
      this._connectionState = this._mapState(state);
      handler(this._connectionState);
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private _mapState(state: string): ConnectionState {
    const map: Record<string, ConnectionState> = {
      connected: ConnectionState.CONNECTED,
      connecting: ConnectionState.CONNECTING,
      disconnected: ConnectionState.DISCONNECTED,
      disconnecting: ConnectionState.DISCONNECTING,
      reconnecting: ConnectionState.RECONNECTING,
      error: ConnectionState.ERROR,
    };
    return map[state.toLowerCase()] ?? ConnectionState.DISCONNECTED;
  }

  private _mapQuality(
    quality: string,
  ): 'good' | 'uncertain' | 'bad' | 'unknown' {
    if (quality === 'good') return 'good';
    if (quality === 'uncertain') return 'uncertain';
    if (quality === 'bad') return 'bad';
    return 'unknown';
  }
}
