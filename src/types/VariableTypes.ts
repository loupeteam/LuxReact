import type { ConnectionState } from './ConnectionState';

// Opaque handle returned by ICommLayer.subscribe(); passed back to unsubscribe()
export type SubscriptionHandle = unknown;

// Returned by onConnectionStateChanged and used for cleanup
export type UnsubscribeFn = () => void;

export type VariableQuality = 'good' | 'uncertain' | 'bad' | 'unknown';

export interface VariableChangeEvent {
  path: string;
  value: unknown;
  timestamp: Date | null;
  quality: VariableQuality | null;
}

export type VariableChangeCallback = (event: VariableChangeEvent) => void;

export type ConnectionStateHandler = (state: ConnectionState) => void;

export interface SubscribeOptions {
  readGroupName?: string;
  samplingInterval?: number;
  publishingInterval?: number;
}

export interface VariableMeta {
  connectionState: ConnectionState;
  timestamp: Date | null;
  quality: VariableQuality | null;
  loading: boolean;
  error: Error | null;
  /** True when the variable is confirmed invalid — bad quality from subscription, null value from subscription, or variable-not-found on write. Resets to false when a valid subscription event arrives. */
  invalid: boolean;
}

export interface VariableConfig<T = unknown> {
  defaultValue?: T;
  readGroupName?: string;
  samplingInterval?: number;
  publishingInterval?: number;
  /** When true, setValue() updates local state immediately; server confirmation overwrites; write failure reverts. */
  optimistic?: boolean;
  /**
   * When true, the nearest VariableScope prefix is NOT applied to the path.
   * Paths that are already absolute (start with '::' or 'ns=') are also bypassed
   * automatically without needing this flag.
   */
  ignoreScope?: boolean;
}

export interface ReadGroupConfig {
  name: string;
  publishingInterval?: number;
  samplingInterval?: number;
}
