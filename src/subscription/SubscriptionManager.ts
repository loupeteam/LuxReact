import type { ICommLayer } from '../types/ICommLayer';
import type {
  SubscriptionHandle,
  VariableChangeCallback,
  VariableChangeEvent,
  SubscribeOptions,
} from '../types/VariableTypes';
import { ParentOptimizer } from './ParentOptimizer';

/**
 * Manages variable subscriptions for a single MachineProvider.
 *
 * Architecture:
 *   - `desiredPaths`        — what hooks/alwaysRead want subscribed
 *   - `registeredParents`   — parents declared via useParent()
 *   - `activeSubscriptions` — what is actually subscribed on the commLayer
 *   - `callbacks`           — per-desired-path listeners (keyed by desired path, not comm path)
 *   - `valueCache`          — last received event per desired path; delivered immediately on (re-)subscribe
 *
 * Reconciliation is debounced via queueMicrotask so that multiple hooks mounting in
 * the same render cycle produce a single diff + subscribe/unsubscribe pass.
 */
export class SubscriptionManager {
  private _machine: ICommLayer;

  private _desiredPaths = new Set<string>();
  private _registeredParents = new Map<string, 'always' | 'onDemand'>();
  private _activeSubscriptions = new Map<string, number>();
  private _callbacks = new Map<string, Set<VariableChangeCallback>>();
  private _valueCache = new Map<string, VariableChangeEvent>();
  private _pendingSubscriptions = new Map<number, {
    cancelled: boolean;
    resolvedHandle: SubscriptionHandle | null;
  }>();
  private _nextInternalHandle = 1;

  /** Extra per-path options (samplingInterval, publishingInterval) stored for reconciliation. */
  private _pathOptions = new Map<string, SubscribeOptions>();

  private _reconcilePending = false;

  constructor(machine: ICommLayer) {
    this._machine = machine;
  }

  // ---------------------------------------------------------------------------
  // Public API — called by useVariable, useParent, MachineProvider
  // ---------------------------------------------------------------------------

  /**
   * Register a desired path and its listener. Called on hook mount.
   * Delivers a cached value synchronously if one exists.
   */
  addDesired(
    path: string,
    callback: VariableChangeCallback,
    options?: SubscribeOptions,
  ): void {
    this._desiredPaths.add(path);

    if (!this._callbacks.has(path)) {
      this._callbacks.set(path, new Set());
    }
    this._callbacks.get(path)!.add(callback);

    // Merge options (last writer wins per field)
    if (options) {
      const existing = this._pathOptions.get(path) ?? {};
      this._pathOptions.set(path, { ...existing, ...options });
    }

    // Deliver cached value immediately
    const cached = this._valueCache.get(path);
    if (cached !== undefined) {
      callback(cached);
    }

    this._scheduleReconciliation();
  }

  /**
   * Remove a desired path listener. Called on hook unmount.
   * If no callbacks remain for the path, removes the path from desiredPaths.
   */
  removeDesired(path: string, callback: VariableChangeCallback): void {
    const cbs = this._callbacks.get(path);
    if (cbs) {
      cbs.delete(callback);
      if (cbs.size === 0) {
        this._callbacks.delete(path);
        this._desiredPaths.delete(path);
        this._pathOptions.delete(path);
      }
    }
    this._scheduleReconciliation();
  }

  /**
   * Register a parent path for optimization. Called by useParent on mount.
   */
  registerParent(path: string, mode: 'always' | 'onDemand'): void {
    this._registeredParents.set(path, mode);
    this._scheduleReconciliation();
  }

  /**
   * Unregister a parent path. Called by useParent on unmount.
   */
  unregisterParent(path: string): void {
    this._registeredParents.delete(path);
    this._scheduleReconciliation();
  }

  /**
   * Tear down all active subscriptions. Called by MachineProvider on unmount.
   */
  destroy(): void {
    for (const [, internalHandle] of this._activeSubscriptions) {
      this._unsubscribeInternal(internalHandle);
    }
    this._activeSubscriptions.clear();
    this._desiredPaths.clear();
    this._registeredParents.clear();
    this._callbacks.clear();
    this._valueCache.clear();
    this._pathOptions.clear();
    this._pendingSubscriptions.clear();
  }

  // ---------------------------------------------------------------------------
  // Reconciliation
  // ---------------------------------------------------------------------------

  private _scheduleReconciliation(): void {
    if (this._reconcilePending) return;
    this._reconcilePending = true;
    queueMicrotask(() => {
      this._reconcilePending = false;
      this._reconcile();
    });
  }

  private _reconcile(): void {
    const optimalPaths = ParentOptimizer.computeOptimalSet(
      this._desiredPaths,
      this._registeredParents,
    );

    // Paths to remove — currently active but not in optimal set
    for (const [path, internalHandle] of this._activeSubscriptions) {
      if (!optimalPaths.has(path)) {
        this._unsubscribeInternal(internalHandle);
        this._activeSubscriptions.delete(path);
      }
    }

    // Paths to add — in optimal set but not currently active
    for (const path of optimalPaths) {
      if (!this._activeSubscriptions.has(path)) {
        const internalHandle = this._nextInternalHandle++;
        const entry = { cancelled: false, resolvedHandle: null as SubscriptionHandle | null };
        this._pendingSubscriptions.set(internalHandle, entry);

        const subscribeResult = this._machine.subscribe(
          path,
          (payload) => this._handleIncoming(path, payload),
          this._pathOptions.get(path),
        );

        Promise.resolve(subscribeResult)
          .then((resolvedHandle) => {
            if (entry.cancelled) {
              void this._machine.unsubscribe(resolvedHandle);
              return;
            }
            entry.resolvedHandle = resolvedHandle;
          })
          .catch((err) => {
            // Log detailed diagnostics to help debug server-side errors (e.g. 507)
            try {
              console.error(`Subscription failed for path=\"${path}\" internalHandle=${internalHandle}`, err);
            } catch (loggingErr) {
              // best-effort logging
              console.error('Subscription failed and diagnostic logging also failed', loggingErr);
            }

            entry.cancelled = true;
            this._pendingSubscriptions.delete(internalHandle);
            const activeInternal = this._activeSubscriptions.get(path);
            if (activeInternal === internalHandle) {
              this._activeSubscriptions.delete(path);
            }
          });

        this._activeSubscriptions.set(path, internalHandle);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Fan-out
  // ---------------------------------------------------------------------------

  private _unsubscribeInternal(internalHandle: number): void {
    const entry = this._pendingSubscriptions.get(internalHandle);
    if (!entry) return;

    entry.cancelled = true;
    this._pendingSubscriptions.delete(internalHandle);

    if (entry.resolvedHandle !== null) {
      void this._machine.unsubscribe(entry.resolvedHandle);
    }
  }

  private _handleIncoming(path: string, payload: unknown): void {
    const maybeEvent =
      payload !== null && typeof payload === 'object'
        ? (payload as Partial<VariableChangeEvent> & { quality?: unknown })
        : null;

    const normalizedEvent: VariableChangeEvent = {
      path: typeof maybeEvent?.path === 'string' ? maybeEvent.path : path,
      value: maybeEvent && 'value' in maybeEvent ? maybeEvent.value : payload,
      timestamp:
        maybeEvent?.timestamp instanceof Date ? maybeEvent.timestamp : new Date(),
      quality:
        maybeEvent?.quality === 'good' ||
        maybeEvent?.quality === 'uncertain' ||
        maybeEvent?.quality === 'bad' ||
        maybeEvent?.quality === 'unknown'
          ? maybeEvent.quality
          : 'good',
    };

    this._handleEvent(normalizedEvent);
  }

  private _handleEvent(event: VariableChangeEvent): void {
    // 1. Deliver directly to exact-path subscribers
    const directCbs = this._callbacks.get(event.path);
    if (directCbs) {
      const cached: VariableChangeEvent = { ...event };
      this._valueCache.set(event.path, cached);
      for (const cb of directCbs) {
        cb(event);
      }
    }

    // 2. Fan-out to child paths covered by this subscription
    for (const [desiredPath, cbs] of this._callbacks) {
      if (ParentOptimizer.isChildOf(desiredPath, event.path)) {
        const childValue = ParentOptimizer.navigatePath(
          event.value,
          desiredPath,
          event.path,
        );
        if (childValue !== undefined) {
          const childEvent: VariableChangeEvent = {
            path: desiredPath,
            value: childValue,
            timestamp: event.timestamp,
            quality: event.quality,
          };
          this._valueCache.set(desiredPath, childEvent);
          for (const cb of cbs) {
            cb(childEvent);
          }
        }
      }
    }
  }
}
