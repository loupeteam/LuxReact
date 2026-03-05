import { useEffect } from 'react';
import { useResolvedContext } from './useResolvedContext';
import { useVariablePrefix, resolvePath } from '../context/VariableScopeContext';

export interface ParentConfig {
  mode: 'always' | 'onDemand';
  machineId?: string;
}

/**
 * Declares a parent-path optimization for the enclosing subtree.
 *
 * - `mode: 'always'`    — parent path subscribed for the lifetime of this component,
 *                         regardless of whether any child hooks are mounted.
 * - `mode: 'onDemand'`  — parent path subscribed only while at least one useVariable
 *                         for a child path is active.
 *
 * Child hooks (useVariable, useWrite) need no changes — they're unaware of this optimization.
 *
 * @param path   The parent path (resolved against nearest VariableScope prefix)
 * @param config Mode and optional machineId
 */
export function useParent(path: string, config: ParentConfig): void {
  const context = useResolvedContext(config.machineId);
  const prefix = useVariablePrefix();
  const resolvedPath = resolvePath(path, prefix);

  useEffect(() => {
    if (!context) return;
    context.subscriptionManager.registerParent(resolvedPath, config.mode);
    return () => {
      context.subscriptionManager.unregisterParent(resolvedPath);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedPath, config.mode, context?.machineId]);
}
