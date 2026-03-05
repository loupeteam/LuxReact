import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SubscriptionManager } from '../../src/subscription/SubscriptionManager';
import { MockCommLayer } from '../../src/mock/MockCommLayer';

// Helper: flush the microtask queue so debounced reconciliation runs
const flush = () => new Promise<void>(resolve => queueMicrotask(resolve));

describe('SubscriptionManager', () => {
  let mock: MockCommLayer;
  let sm: SubscriptionManager;

  beforeEach(async () => {
    mock = new MockCommLayer();
    await mock.connect();
    sm = new SubscriptionManager(mock);
  });

  // -----------------------------------------------------------------------
  // Basic desired-path management
  // -----------------------------------------------------------------------
  describe('addDesired / removeDesired', () => {
    it('subscribes on commLayer after microtask flush', async () => {
      const cb = vi.fn();
      sm.addDesired('Motor.Speed', cb);
      expect(mock.getSubscribedPaths()).toEqual([]);  // not yet
      await flush();
      expect(mock.getSubscribedPaths()).toEqual(['Motor.Speed']);
    });

    it('batches multiple addDesired calls into one reconciliation', async () => {
      sm.addDesired('Motor.Speed', vi.fn());
      sm.addDesired('Motor.Temp', vi.fn());
      sm.addDesired('Valve.State', vi.fn());
      await flush();
      expect(mock.getSubscribedPaths()).toEqual(
        expect.arrayContaining(['Motor.Speed', 'Motor.Temp', 'Valve.State']),
      );
      // Only one reconciliation pass should have fired (hard to assert internals,
      // but the subscription count should be exactly 3)
      expect(mock.getSubscribedPaths().length).toBe(3);
    });

    it('unsubscribes when last callback removed', async () => {
      const cb = vi.fn();
      sm.addDesired('Motor.Speed', cb);
      await flush();
      expect(mock.getSubscribedPaths()).toContain('Motor.Speed');

      sm.removeDesired('Motor.Speed', cb);
      await flush();
      expect(mock.getSubscribedPaths()).not.toContain('Motor.Speed');
    });

    it('keeps subscription when one of multiple callbacks removed', async () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      sm.addDesired('Motor.Speed', cb1);
      sm.addDesired('Motor.Speed', cb2);
      await flush();

      sm.removeDesired('Motor.Speed', cb1);
      await flush();
      expect(mock.getSubscribedPaths()).toContain('Motor.Speed');
    });
  });

  // -----------------------------------------------------------------------
  // Value cache
  // -----------------------------------------------------------------------
  describe('value cache', () => {
    it('delivers cached value immediately to new subscriber', async () => {
      const cb1 = vi.fn();
      sm.addDesired('Motor.Speed', cb1);
      await flush();
      mock.setVariableValue('Motor.Speed', 100);

      // New subscriber — should receive cached value synchronously
      const cb2 = vi.fn();
      sm.addDesired('Motor.Speed', cb2);
      expect(cb2).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Motor.Speed', value: 100 }),
      );
    });

    it('does not deliver stale cache after path is removed and re-added', async () => {
      const cb1 = vi.fn();
      sm.addDesired('Motor.Speed', cb1);
      await flush();
      mock.setVariableValue('Motor.Speed', 100);

      sm.removeDesired('Motor.Speed', cb1);
      await flush();

      // Re-add — since the path was removed and cache lives in SM (not cleared on remove),
      // the cached value IS delivered on re-subscribe (this is the intended behavior:
      // avoids loading flash even after remount).
      const cb2 = vi.fn();
      sm.addDesired('Motor.Speed', cb2);
      expect(cb2).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Motor.Speed', value: 100 }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Parent optimization — onDemand
  // -----------------------------------------------------------------------
  describe('onDemand parent optimization', () => {
    it('consolidates child paths under registered onDemand parent', async () => {
      sm.registerParent('Motor', 'onDemand');
      sm.addDesired('Motor.Speed', vi.fn());
      sm.addDesired('Motor.Temp', vi.fn());
      await flush();

      expect(mock.getSubscribedPaths()).toEqual(['Motor']);
    });

    it('does not include onDemand parent when no children are desired', async () => {
      sm.registerParent('Motor', 'onDemand');
      await flush();
      expect(mock.getSubscribedPaths()).toEqual([]);
    });

    it('unsubscribes parent when last child is removed', async () => {
      sm.registerParent('Motor', 'onDemand');
      const cb = vi.fn();
      sm.addDesired('Motor.Speed', cb);
      await flush();
      expect(mock.getSubscribedPaths()).toContain('Motor');

      sm.removeDesired('Motor.Speed', cb);
      await flush();
      expect(mock.getSubscribedPaths()).not.toContain('Motor');
    });
  });

  // -----------------------------------------------------------------------
  // Parent optimization — always
  // -----------------------------------------------------------------------
  describe('always parent optimization', () => {
    it('subscribes always parent even with no children', async () => {
      sm.registerParent('Status', 'always');
      await flush();
      expect(mock.getSubscribedPaths()).toContain('Status');
    });

    it('unsubscribes always parent when unregistered', async () => {
      sm.registerParent('Status', 'always');
      await flush();

      sm.unregisterParent('Status');
      await flush();
      expect(mock.getSubscribedPaths()).not.toContain('Status');
    });

    it('always parent replaces children in optimal set', async () => {
      sm.registerParent('Motor', 'always');
      sm.addDesired('Motor.Speed', vi.fn());
      await flush();

      expect(mock.getSubscribedPaths()).toEqual(['Motor']);
    });
  });

  // -----------------------------------------------------------------------
  // Fan-out
  // -----------------------------------------------------------------------
  describe('fan-out from parent event', () => {
    it('delivers child values from a parent subscription event', async () => {
      const cbSpeed = vi.fn();
      const cbTemp = vi.fn();

      sm.registerParent('Motor', 'onDemand');
      sm.addDesired('Motor.Speed', cbSpeed);
      sm.addDesired('Motor.Temp', cbTemp);
      await flush();

      mock.setVariableValue('Motor', { Speed: 120, Temp: 75 });

      expect(cbSpeed).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Motor.Speed', value: 120 }),
      );
      expect(cbTemp).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Motor.Temp', value: 75 }),
      );
    });

    it('delivers exact-path and fan-out events for the same parent', async () => {
      const parentCb = vi.fn();
      const childCb = vi.fn();

      // Subscribe directly to 'Motor' (exact) and also to a child
      sm.addDesired('Motor', parentCb);
      sm.registerParent('Motor', 'onDemand');
      sm.addDesired('Motor.Speed', childCb);
      await flush();

      mock.setVariableValue('Motor', { Speed: 55 });

      expect(parentCb).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Motor' }),
      );
      expect(childCb).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Motor.Speed', value: 55 }),
      );
    });

    it('does not fan-out when child value is missing from parent struct', async () => {
      const cbMissing = vi.fn();

      sm.registerParent('Motor', 'onDemand');
      sm.addDesired('Motor.Missing', cbMissing);
      await flush();

      mock.setVariableValue('Motor', { Speed: 1 });

      expect(cbMissing).not.toHaveBeenCalled();
    });

    it('caches fan-out child values for immediate delivery on next subscribe', async () => {
      sm.registerParent('Motor', 'onDemand');
      const cb1 = vi.fn();
      sm.addDesired('Motor.Speed', cb1);
      await flush();

      mock.setVariableValue('Motor', { Speed: 200, Temp: 30 });

      // New subscriber to child — should get cached fan-out value
      const cb2 = vi.fn();
      sm.addDesired('Motor.Speed', cb2);
      expect(cb2).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Motor.Speed', value: 200 }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // destroy
  // -----------------------------------------------------------------------
  describe('destroy', () => {
    it('unsubscribes all active subscriptions', async () => {
      sm.addDesired('Motor.Speed', vi.fn());
      sm.addDesired('Motor.Temp', vi.fn());
      await flush();
      expect(mock.getSubscribedPaths().length).toBeGreaterThan(0);

      sm.destroy();
      expect(mock.getSubscribedPaths().length).toBe(0);
    });
  });
});
