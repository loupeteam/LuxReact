import { useMemo } from 'react';
import { VariableScopeContext, useVariablePrefix, resolvePath } from '../context/VariableScopeContext';

interface VariableScopeProps {
  prefix: string;
  children: React.ReactNode;
}

/**
 * Stacks a path prefix onto the enclosing VariableScopeContext.
 *
 * All useVariable / useWrite / useParent hooks inside will resolve their
 * bare path names against the accumulated prefix.
 *
 * Scopes are stackable:
 *   <MachineProvider variablePrefix="::AsGlobalPV:">
 *     <VariableScope prefix="Motor">
 *       <VariableScope prefix="Axis[0]">
 *         {/* useVariable('Pos') → '::AsGlobalPV:Motor.Axis[0].Pos' *\/}
 *       </VariableScope>
 *     </VariableScope>
 *   </MachineProvider>
 */
export function VariableScope({ prefix, children }: VariableScopeProps): React.JSX.Element {
  const parentPrefix = useVariablePrefix();
  const fullPrefix = useMemo(
    () => resolvePath(prefix, parentPrefix),
    [prefix, parentPrefix],
  );

  return (
    <VariableScopeContext.Provider value={fullPrefix}>
      {children}
    </VariableScopeContext.Provider>
  );
}
