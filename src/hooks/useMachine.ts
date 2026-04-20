import { useResolvedContext } from './useResolvedContext';
import type { ConnectionState } from '../types/ConnectionState';

export interface MachineControls {
  machineId: string;
  connectionState: ConnectionState;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  readVariable(path: string): Promise<unknown>;
  writeVariable(path: string, value: unknown): Promise<void>;
  // Present only if commLayer implements them:
  changeUser?: (username: string, password: string) => Promise<void>;
  writeMany?: (values: Record<string, unknown>) => Promise<void>;
  getCurrentUser?: () => string | undefined;
}

/**
 * Returns connection state and imperative controls for a machine.
 *
 * @param machineId Optional: look up a specific machine by id.
 *                  If omitted, uses the nearest MachineProvider in the tree.
 *
 * @throws If no context can be resolved.
 */
export function useMachine(machineId?: string): MachineControls {
  const context = useResolvedContext(machineId);

  if (!context) {
    throw new Error(
      machineId
        ? `[lux-react] useMachine: no machine registered with id "${machineId}"`
        : '[lux-react] useMachine: must be used inside a MachineProvider',
    );
  }

  const { commLayer } = context;

  const controls: MachineControls = {
    machineId: context.machineId,
    connectionState: context.connectionState,
    connect: () => commLayer.connect(),
    disconnect: () => commLayer.disconnect(),
    readVariable: (path) => commLayer.readVariable(path),
    writeVariable: (path, value) => commLayer.writeVariable(path, value),
  };

  if (commLayer.changeUser) {
    controls.changeUser = (username, password) =>
      commLayer.changeUser!(username, password);
  }

  if (commLayer.writeMany) {
    controls.writeMany = (values) => commLayer.writeMany!(values);
  }

  if (commLayer.getCurrentUser) {
    controls.getCurrentUser = () => commLayer.getCurrentUser!();
  }

  return controls;
}
