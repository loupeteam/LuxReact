/**
 * Pure static utilities for parent-path optimization.
 * No side effects; safe to use in tests without any React context.
 *
 * Path convention:
 *   - Dot-separated struct access:   Motor.Speed
 *   - Bracket array indexing:        Axis[0].Pos
 *   - Both combined:                 Motor.Axis[0].Speed
 */
export class ParentOptimizer {
  /**
   * Returns the immediate logical parent segment of a path, or null if path is a root.
   *
   * 'Motor.Speed'       → 'Motor'
   * 'Motor.Axis[0].Pos' → 'Motor.Axis[0]'
   * 'Axis[0]'           → 'Axis'
   * 'Motor'             → null
   */
  static getParentPath(path: string): string | null {
    // Find last '.' or '[' — whichever comes last
    const lastDot = path.lastIndexOf('.');
    const lastBracket = path.lastIndexOf('[');

    const splitAt = Math.max(lastDot, lastBracket);
    if (splitAt <= 0) return null;

    return path.slice(0, splitAt);
  }

  /**
   * Returns true when childPath is strictly under parentPath (not equal to it).
   *
   * A child path must start with the parent path followed by '.' or '['.
   * This prevents 'MotorSpeed' from being considered a child of 'Motor'.
   *
   * 'Motor.Speed'        isChildOf 'Motor'       → true
   * 'Motor.Axis[0].Pos'  isChildOf 'Motor'       → true
   * 'Motor.Speed'        isChildOf 'Motor.Speed' → false  (same path)
   * 'MotorSpeed'         isChildOf 'Motor'       → false  (no separator)
   * 'Motor'              isChildOf 'Motor.Speed' → false  (parent cannot be child)
   */
  static isChildOf(childPath: string, parentPath: string): boolean {
    if (childPath === parentPath) return false;
    if (!childPath.startsWith(parentPath)) return false;
    const nextChar = childPath[parentPath.length];
    return nextChar === '.' || nextChar === '[';
  }

  /**
   * Navigate a parent value object along the suffix of childPath relative to parentPath.
   *
   * navigatePath({ Speed: 100 }, 'Motor.Speed', 'Motor') → 100
   * navigatePath({ Axis: [{ Pos: 5 }] }, 'Motor.Axis[0].Pos', 'Motor') → 5
   * navigatePath(undefined, 'Motor.Speed', 'Motor') → undefined
   *
   * Returns undefined if the path cannot be resolved (missing keys, wrong types, etc.)
   */
  static navigatePath(
    parentValue: unknown,
    childPath: string,
    parentPath: string,
  ): unknown {
    if (!ParentOptimizer.isChildOf(childPath, parentPath)) return undefined;
    if (parentValue === null || parentValue === undefined) return undefined;

    // The suffix after the parent path, e.g. '.Speed' or '.Axis[0].Pos'
    const suffix = childPath.slice(parentPath.length);

    // Tokenise the suffix into path segments
    const segments = ParentOptimizer._parseSuffix(suffix);

    let current: unknown = parentValue;
    for (const segment of segments) {
      if (current === null || current === undefined) return undefined;
      if (typeof segment === 'number') {
        if (!Array.isArray(current)) return undefined;
        current = current[segment];
      } else {
        if (typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[segment];
      }
    }
    return current;
  }

  /**
   * Given desired paths and registered parents, compute the optimal set of paths
   * to actually subscribe to on the comm layer.
   *
   * Rules:
   * - 'always' parent: include parent path regardless of whether any child is desired.
   * - 'onDemand' parent: include parent path only if at least one desired path is a child.
   * - Any desired path not covered by a registered parent is kept as-is.
   * - Results are de-duplicated.
   */
  static computeOptimalSet(
    desiredPaths: ReadonlySet<string>,
    registeredParents: ReadonlyMap<string, 'always' | 'onDemand'>,
  ): Set<string> {
    const result = new Set<string>();

    // Always-mode parents are included unconditionally
    for (const [parentPath, mode] of registeredParents) {
      if (mode === 'always') {
        result.add(parentPath);
      }
    }

    // Process each desired path
    for (const desiredPath of desiredPaths) {
      const coveringParent = ParentOptimizer._findCoveringParent(
        desiredPath,
        registeredParents,
      );

      if (coveringParent !== null) {
        const mode = registeredParents.get(coveringParent)!;
        if (mode === 'always') {
          // Parent already added above; don't add the child path
          // (parent subscription will fan-out the child value)
        } else {
          // onDemand: replace child with parent (there is at least one child present)
          result.add(coveringParent);
        }
      } else {
        // No registered parent covers this path — subscribe directly
        result.add(desiredPath);
      }
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /** Find the registered parent path (if any) that covers the given desired path. */
  private static _findCoveringParent(
    desiredPath: string,
    registeredParents: ReadonlyMap<string, 'always' | 'onDemand'>,
  ): string | null {
    let best: string | null = null;
    for (const parentPath of registeredParents.keys()) {
      if (ParentOptimizer.isChildOf(desiredPath, parentPath)) {
        // Prefer the most-specific (longest) parent if multiple match
        if (best === null || parentPath.length > best.length) {
          best = parentPath;
        }
      }
    }
    return best;
  }

  /**
   * Parse the path suffix (starting with '.' or '[') into an array of string/number segments.
   * e.g. '.Speed'          → ['Speed']
   *      '.Axis[0].Pos'    → ['Axis', 0, 'Pos']
   *      '[0].Pos'         → [0, 'Pos']
   */
  private static _parseSuffix(suffix: string): Array<string | number> {
    const segments: Array<string | number> = [];
    // Tokenise: split on '.' and '[n]'
    // A suffix like '.Axis[0].Pos' needs to yield ['Axis', 0, 'Pos']
    let remaining = suffix;

    while (remaining.length > 0) {
      if (remaining[0] === '.') {
        remaining = remaining.slice(1);
        // Read until next '.' or '['
        const end = remaining.search(/[.[]/);
        if (end === -1) {
          segments.push(remaining);
          break;
        }
        segments.push(remaining.slice(0, end));
        remaining = remaining.slice(end);
      } else if (remaining[0] === '[') {
        const close = remaining.indexOf(']');
        if (close === -1) break; // malformed path — stop
        const idx = parseInt(remaining.slice(1, close), 10);
        if (!isNaN(idx)) segments.push(idx);
        remaining = remaining.slice(close + 1);
      } else {
        // Shouldn't happen for well-formed paths, but handle gracefully
        break;
      }
    }

    return segments;
  }
}
