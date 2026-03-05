import { describe, it, expect } from 'vitest';
import { ParentOptimizer } from '../../src/subscription/ParentOptimizer';

describe('ParentOptimizer', () => {
  // ---------------------------------------------------------------------------
  // getParentPath
  // ---------------------------------------------------------------------------
  describe('getParentPath', () => {
    it('returns the parent segment for a dot-separated path', () => {
      expect(ParentOptimizer.getParentPath('Motor.Speed')).toBe('Motor');
    });

    it('returns the nested parent for a deep path', () => {
      expect(ParentOptimizer.getParentPath('Motor.Axis[0].Pos')).toBe('Motor.Axis[0]');
    });

    it('returns the struct name for an array path', () => {
      expect(ParentOptimizer.getParentPath('Axis[0]')).toBe('Axis');
    });

    it('returns null for a root-level name', () => {
      expect(ParentOptimizer.getParentPath('Motor')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(ParentOptimizer.getParentPath('')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // isChildOf
  // ---------------------------------------------------------------------------
  describe('isChildOf', () => {
    it('returns true for direct dot child', () => {
      expect(ParentOptimizer.isChildOf('Motor.Speed', 'Motor')).toBe(true);
    });

    it('returns true for deep dot child', () => {
      expect(ParentOptimizer.isChildOf('Motor.Axis[0].Pos', 'Motor')).toBe(true);
    });

    it('returns true for direct bracket child', () => {
      expect(ParentOptimizer.isChildOf('Axis[0]', 'Axis')).toBe(true);
    });

    it('returns false when paths are equal', () => {
      expect(ParentOptimizer.isChildOf('Motor.Speed', 'Motor.Speed')).toBe(false);
    });

    it('returns false when no separator matches (prefix clash)', () => {
      expect(ParentOptimizer.isChildOf('MotorSpeed', 'Motor')).toBe(false);
    });

    it('returns false when childPath is shorter than parentPath', () => {
      expect(ParentOptimizer.isChildOf('Motor', 'Motor.Speed')).toBe(false);
    });

    it('returns false for unrelated paths', () => {
      expect(ParentOptimizer.isChildOf('Valve.State', 'Motor')).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // navigatePath
  // ---------------------------------------------------------------------------
  describe('navigatePath', () => {
    it('navigates a simple dot property', () => {
      const val = { Speed: 100, Temp: 25 };
      expect(ParentOptimizer.navigatePath(val, 'Motor.Speed', 'Motor')).toBe(100);
    });

    it('navigates an array index', () => {
      const val = [{ Pos: 5 }, { Pos: 10 }];
      expect(ParentOptimizer.navigatePath(val, 'Axis[0].Pos', 'Axis')).toBe(5);
    });

    it('navigates a nested struct inside an array', () => {
      const val = { Axis: [{ Pos: 3 }] };
      expect(
        ParentOptimizer.navigatePath(val, 'Motor.Axis[0].Pos', 'Motor'),
      ).toBe(3);
    });

    it('returns undefined for a missing key', () => {
      const val = { Temp: 25 };
      expect(
        ParentOptimizer.navigatePath(val, 'Motor.Speed', 'Motor'),
      ).toBeUndefined();
    });

    it('returns undefined when parentValue is null', () => {
      expect(ParentOptimizer.navigatePath(null, 'Motor.Speed', 'Motor')).toBeUndefined();
    });

    it('returns undefined when parentValue is undefined', () => {
      expect(
        ParentOptimizer.navigatePath(undefined, 'Motor.Speed', 'Motor'),
      ).toBeUndefined();
    });

    it('returns undefined when childPath is not under parentPath', () => {
      expect(
        ParentOptimizer.navigatePath({ Speed: 1 }, 'Valve.State', 'Motor'),
      ).toBeUndefined();
    });

    it('returns undefined when array index is out of range', () => {
      const val = [{ Pos: 1 }];
      expect(
        ParentOptimizer.navigatePath(val, 'Axis[5].Pos', 'Axis'),
      ).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // computeOptimalSet
  // ---------------------------------------------------------------------------
  describe('computeOptimalSet', () => {
    it('returns desired paths as-is when no parents registered', () => {
      const desired = new Set(['Motor.Speed', 'Motor.Temp']);
      const parents = new Map<string, 'always' | 'onDemand'>();
      const result = ParentOptimizer.computeOptimalSet(desired, parents);
      expect([...result]).toEqual(expect.arrayContaining(['Motor.Speed', 'Motor.Temp']));
      expect(result.size).toBe(2);
    });

    it('consolidates children under an onDemand parent when children exist', () => {
      const desired = new Set(['Motor.Speed', 'Motor.Temp']);
      const parents = new Map<string, 'always' | 'onDemand'>([
        ['Motor', 'onDemand'],
      ]);
      const result = ParentOptimizer.computeOptimalSet(desired, parents);
      expect([...result]).toEqual(['Motor']);
    });

    it('includes always parent even with no children in desired', () => {
      const desired = new Set<string>();
      const parents = new Map<string, 'always' | 'onDemand'>([
        ['Motor', 'always'],
      ]);
      const result = ParentOptimizer.computeOptimalSet(desired, parents);
      expect([...result]).toEqual(['Motor']);
    });

    it('always parent replaces its children', () => {
      const desired = new Set(['Motor.Speed', 'Motor.Temp']);
      const parents = new Map<string, 'always' | 'onDemand'>([
        ['Motor', 'always'],
      ]);
      const result = ParentOptimizer.computeOptimalSet(desired, parents);
      expect([...result]).toEqual(['Motor']);
    });

    it('onDemand parent not included when desired set is empty', () => {
      const desired = new Set<string>();
      const parents = new Map<string, 'always' | 'onDemand'>([
        ['Motor', 'onDemand'],
      ]);
      const result = ParentOptimizer.computeOptimalSet(desired, parents);
      expect(result.size).toBe(0);
    });

    it('mixes covered and uncovered paths', () => {
      const desired = new Set(['Motor.Speed', 'Valve.State']);
      const parents = new Map<string, 'always' | 'onDemand'>([
        ['Motor', 'onDemand'],
      ]);
      const result = ParentOptimizer.computeOptimalSet(desired, parents);
      expect([...result]).toEqual(expect.arrayContaining(['Motor', 'Valve.State']));
      expect(result.size).toBe(2);
    });

    it('de-duplicates: two always parents covering same children do not duplicate', () => {
      const desired = new Set(['A.X']);
      const parents = new Map<string, 'always' | 'onDemand'>([
        ['A', 'always'],
      ]);
      const result = ParentOptimizer.computeOptimalSet(desired, parents);
      expect(result.size).toBe(1);
      expect([...result]).toEqual(['A']);
    });

    it('selects the most-specific matching parent', () => {
      const desired = new Set(['Motor.Axis[0].Pos']);
      const parents = new Map<string, 'always' | 'onDemand'>([
        ['Motor', 'onDemand'],
        ['Motor.Axis[0]', 'onDemand'],
      ]);
      const result = ParentOptimizer.computeOptimalSet(desired, parents);
      // Should consolidate under the more specific parent
      expect([...result]).toEqual(expect.arrayContaining(['Motor.Axis[0]']));
      expect(result.has('Motor')).toBe(false);
    });
  });
});
