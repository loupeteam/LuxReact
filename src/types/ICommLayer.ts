import type { ConnectionState } from './ConnectionState';
import type {
  SubscriptionHandle,
  UnsubscribeFn,
  VariableChangeCallback,
  ConnectionStateHandler,
  SubscribeOptions,
} from './VariableTypes';

export interface ICommLayer {
  readonly connectionState: ConnectionState;

  connect(): Promise<void>;
  disconnect(): Promise<void>;

  readVariable(path: string): Promise<unknown>;
  writeVariable(path: string, value: unknown): Promise<void>;

  /**
   * Subscribe to a variable. Returns a handle synchronously — the adapter handles
   * any internal async setup. React useEffect cleanup calls unsubscribe() synchronously.
   */
  subscribe(
    path: string,
    callback: VariableChangeCallback,
    options?: SubscribeOptions,
  ): SubscriptionHandle;

  unsubscribe(handle: SubscriptionHandle): void;

  onConnectionStateChanged(handler: ConnectionStateHandler): UnsubscribeFn;

  // Optional capabilities — adapters implement only what their comm layer supports.
  // useMachine() exposes these only when present.
  changeUser?(username: string, password: string): Promise<void>;
  writeMany?(values: Record<string, unknown>): Promise<void>;
}
