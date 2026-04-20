import { ConnectionState } from '../types/ConnectionState';
import type { ICommLayer } from '../types/ICommLayer';
import type {
  SubscriptionHandle,
  UnsubscribeFn,
  VariableChangeCallback,
  VariableChangeEvent,
  ConnectionStateHandler,
  SubscribeOptions,
} from '../types/VariableTypes';

interface MockSubscription {
  path: string;
  callback: VariableChangeCallback;
  options: SubscribeOptions | undefined;
}

/**
 * In-memory ICommLayer for tests.
 *
 * Usage:
 *   const mock = new MockCommLayer();
 *   mock.setVariableValue('Motor.Speed', 1200);   // fires all subscribers for that path
 *   mock.getSubscribedPaths();                     // ['Motor.Speed']
 *   mock.getLastWrittenValue('Motor.Speed');       // undefined until writeVariable is called
 */
export class MockCommLayer implements ICommLayer {
  private _connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private _subscriptions = new Map<SubscriptionHandle, MockSubscription>();
  private _nextHandle = 1;
  private _values = new Map<string, unknown>();
  private _writtenValues = new Map<string, unknown>();
  private _connectionStateHandlers = new Set<ConnectionStateHandler>();
  private _currentUser: string | undefined = undefined;
  private _userChangeHandlers = new Set<(username: string | undefined) => void>();

  // --- ICommLayer implementation ---

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  async connect(): Promise<void> {
    this._setConnectionState(ConnectionState.CONNECTED);
  }

  async disconnect(): Promise<void> {
    this._setConnectionState(ConnectionState.DISCONNECTED);
  }

  async readVariable(path: string): Promise<unknown> {
    return this._values.get(path) ?? null;
  }

  async writeVariable(path: string, value: unknown): Promise<void> {
    this._writtenValues.set(path, value);
  }

  subscribe(
    path: string,
    callback: (value: unknown) => void,
    options?: SubscribeOptions | number,
  ): SubscriptionHandle | Promise<SubscriptionHandle> {
    const handle: SubscriptionHandle = this._nextHandle++;
    this._subscriptions.set(handle, {
      path,
      callback: callback as VariableChangeCallback,
      options: typeof options === 'number' ? { samplingInterval: options } : options,
    });

    // Deliver cached value immediately if available
    if (this._values.has(path)) {
      const value = this._values.get(path);
      callback({
        path,
        value,
        timestamp: new Date(),
        quality: 'good',
      });
    }

    return handle;
  }

  unsubscribe(handle: SubscriptionHandle): void | Promise<void> {
    this._subscriptions.delete(handle);
  }

  onConnectionStateChanged(handler: ConnectionStateHandler): UnsubscribeFn {
    this._connectionStateHandlers.add(handler);
    return () => this._connectionStateHandlers.delete(handler);
  }

  onConnectionStateChange(handler: ConnectionStateHandler): UnsubscribeFn {
    return this.onConnectionStateChanged(handler);
  }

  getCurrentUser(): string | undefined {
    return this._currentUser;
  }

  onUserChanged(handler: (username: string | undefined) => void): UnsubscribeFn {
    this._userChangeHandlers.add(handler);
    return () => this._userChangeHandlers.delete(handler);
  }

  // --- Test helpers ---

  /**
   * Simulate the PLC pushing a new value for a path. Fires all subscribers for that path.
   */
  setVariableValue(path: string, value: unknown, timestamp?: Date): void {
    this._values.set(path, value);
    const event: VariableChangeEvent = {
      path,
      value,
      timestamp: timestamp ?? new Date(),
      quality: 'good',
    };
    for (const sub of this._subscriptions.values()) {
      if (sub.path === path) {
        sub.callback(event);
      }
    }
  }

  /**
   * Returns all paths currently subscribed via subscribe().
   */
  getSubscribedPaths(): string[] {
    return Array.from(new Set(Array.from(this._subscriptions.values()).map(s => s.path)));
  }

  /**
   * Returns the last value written via writeVariable(), or undefined if never written.
   */
  getLastWrittenValue(path: string): unknown {
    return this._writtenValues.get(path);
  }

  /**
   * Set the mock current user (simulates a logged-in user). Fires onUserChanged handlers.
   */
  setCurrentUser(username: string | undefined): void {
    this._currentUser = username;
    for (const handler of this._userChangeHandlers) handler(username);
  }

  /**
   * Simulate a connection state change (e.g., disconnection, error).
   */
  simulateConnectionState(state: ConnectionState): void {
    this._setConnectionState(state);
  }

  private _setConnectionState(state: ConnectionState): void {
    this._connectionState = state;
    for (const handler of this._connectionStateHandlers) {
      handler(state);
    }
  }
}
