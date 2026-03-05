import { createContext, useContext } from 'react';

/**
 * Stacked path-prefix context.
 *
 * - MachineProvider sets this to `variablePrefix` (root namespace).
 * - VariableScope stacks additional segments on top.
 * - All hooks (useVariable, useWrite, useParent) prepend the current prefix
 *   to bare path names before passing them to the SubscriptionManager.
 *
 * Resolution: if prefix is '::AsGlobalPV:Motor' and hook uses 'Speed',
 *   the resolved path is '::AsGlobalPV:Motor.Speed'.
 *
 * The prefix stored in context is always the full accumulated prefix
 * (providers and nested scopes concatenate, not nest separately).
 */
export const VariableScopeContext = createContext<string>('');

/**
 * Returns the current path prefix from context.
 */
export function useVariablePrefix(): string {
  return useContext(VariableScopeContext);
}

/**
 * Resolves a hook path against the current prefix.
 *
 * Rules:
 * - Empty prefix: returns path as-is.
 * - Non-empty prefix + non-empty path: joins with '.'
 * - Non-empty prefix + empty path: returns prefix (for useParent on whole scope)
 */
export function resolvePath(path: string, prefix: string): string {
  if (!prefix) return path;
  if (!path) return prefix;
  return `${prefix}.${path}`;
}
