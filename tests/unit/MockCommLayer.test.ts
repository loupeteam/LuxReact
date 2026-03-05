import { describe, it, expect, vi } from 'vitest';
import { MockCommLayer } from '../../src/mock/MockCommLayer';
import { ConnectionState } from '../../src/types/ConnectionState';

describe('MockCommLayer', () => {
  describe('connection', () => {
    it('starts disconnected', () => {
      const mock = new MockCommLayer();
      expect(mock.connectionState).toBe(ConnectionState.DISCONNECTED);
    });

    it('transitions to CONNECTED on connect()', async () => {
      const mock = new MockCommLayer();
      await mock.connect();
      expect(mock.connectionState).toBe(ConnectionState.CONNECTED);
    });

    it('transitions to DISCONNECTED on disconnect()', async () => {
      const mock = new MockCommLayer();
      await mock.connect();
      await mock.disconnect();
      expect(mock.connectionState).toBe(ConnectionState.DISCONNECTED);
    });

    it('fires onConnectionStateChanged handlers', async () => {
      const mock = new MockCommLayer();
      const handler = vi.fn();
      mock.onConnectionStateChanged(handler);
      await mock.connect();
      expect(handler).toHaveBeenCalledWith(ConnectionState.CONNECTED);
    });

    it('unsubscribes onConnectionStateChanged handler', async () => {
      const mock = new MockCommLayer();
      const handler = vi.fn();
      const unsub = mock.onConnectionStateChanged(handler);
      unsub();
      await mock.connect();
      expect(handler).not.toHaveBeenCalled();
    });

    it('simulateConnectionState fires handlers', () => {
      const mock = new MockCommLayer();
      const handler = vi.fn();
      mock.onConnectionStateChanged(handler);
      mock.simulateConnectionState(ConnectionState.ERROR);
      expect(handler).toHaveBeenCalledWith(ConnectionState.ERROR);
      expect(mock.connectionState).toBe(ConnectionState.ERROR);
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('returns a handle', () => {
      const mock = new MockCommLayer();
      const handle = mock.subscribe('Motor.Speed', vi.fn());
      expect(handle).toBeDefined();
    });

    it('fires callback immediately if a value is already cached', () => {
      const mock = new MockCommLayer();
      mock.setVariableValue('Motor.Speed', 100);
      const cb = vi.fn();
      mock.subscribe('Motor.Speed', cb);
      expect(cb).toHaveBeenCalledOnce();
      expect(cb.mock.calls[0][0]).toMatchObject({ path: 'Motor.Speed', value: 100 });
    });

    it('does not fire callback immediately if no cached value', () => {
      const mock = new MockCommLayer();
      const cb = vi.fn();
      mock.subscribe('Motor.Speed', cb);
      expect(cb).not.toHaveBeenCalled();
    });

    it('fires callback when setVariableValue is called', () => {
      const mock = new MockCommLayer();
      const cb = vi.fn();
      mock.subscribe('Motor.Speed', cb);
      mock.setVariableValue('Motor.Speed', 42);
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'Motor.Speed', value: 42 }),
      );
    });

    it('fires all subscribers for a path', () => {
      const mock = new MockCommLayer();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      mock.subscribe('Motor.Speed', cb1);
      mock.subscribe('Motor.Speed', cb2);
      mock.setVariableValue('Motor.Speed', 99);
      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });

    it('does not fire unsubscribed callbacks', () => {
      const mock = new MockCommLayer();
      const cb = vi.fn();
      const handle = mock.subscribe('Motor.Speed', cb);
      mock.unsubscribe(handle);
      mock.setVariableValue('Motor.Speed', 1);
      expect(cb).not.toHaveBeenCalled();
    });

    it('only fires subscribers for the matching path', () => {
      const mock = new MockCommLayer();
      const cbSpeed = vi.fn();
      const cbTemp = vi.fn();
      mock.subscribe('Motor.Speed', cbSpeed);
      mock.subscribe('Motor.Temp', cbTemp);
      mock.setVariableValue('Motor.Speed', 1);
      expect(cbSpeed).toHaveBeenCalledOnce();
      expect(cbTemp).not.toHaveBeenCalled();
    });
  });

  describe('getSubscribedPaths', () => {
    it('returns empty array when no subscriptions', () => {
      const mock = new MockCommLayer();
      expect(mock.getSubscribedPaths()).toEqual([]);
    });

    it('returns subscribed paths', () => {
      const mock = new MockCommLayer();
      mock.subscribe('Motor.Speed', vi.fn());
      mock.subscribe('Motor.Temp', vi.fn());
      expect(mock.getSubscribedPaths()).toEqual(
        expect.arrayContaining(['Motor.Speed', 'Motor.Temp']),
      );
    });

    it('de-duplicates paths with multiple subscribers', () => {
      const mock = new MockCommLayer();
      mock.subscribe('Motor.Speed', vi.fn());
      mock.subscribe('Motor.Speed', vi.fn());
      expect(mock.getSubscribedPaths()).toEqual(['Motor.Speed']);
    });

    it('removes path when all subscribers unsubscribed', () => {
      const mock = new MockCommLayer();
      const h1 = mock.subscribe('Motor.Speed', vi.fn());
      const h2 = mock.subscribe('Motor.Speed', vi.fn());
      mock.unsubscribe(h1);
      mock.unsubscribe(h2);
      expect(mock.getSubscribedPaths()).toEqual([]);
    });
  });

  describe('readVariable / writeVariable', () => {
    it('readVariable returns null for unknown path', async () => {
      const mock = new MockCommLayer();
      expect(await mock.readVariable('Unknown')).toBeNull();
    });

    it('readVariable returns cached value', async () => {
      const mock = new MockCommLayer();
      mock.setVariableValue('Motor.Speed', 123);
      expect(await mock.readVariable('Motor.Speed')).toBe(123);
    });

    it('writeVariable stores the value in writtenValues', async () => {
      const mock = new MockCommLayer();
      await mock.writeVariable('Motor.Speed', 500);
      expect(mock.getLastWrittenValue('Motor.Speed')).toBe(500);
    });

    it('getLastWrittenValue returns undefined for unwritten path', () => {
      const mock = new MockCommLayer();
      expect(mock.getLastWrittenValue('Motor.Speed')).toBeUndefined();
    });
  });
});
