// Types
export { ConnectionState } from './types/ConnectionState';
export type { ICommLayer } from './types/ICommLayer';
export type {
  SubscriptionHandle,
  UnsubscribeFn,
  VariableQuality,
  VariableChangeEvent,
  VariableChangeCallback,
  ConnectionStateHandler,
  SubscribeOptions,
  VariableMeta,
  VariableConfig,
  ReadGroupConfig,
} from './types/VariableTypes';

// Provider
export { MachineProvider } from './provider/MachineProvider';
export type { MachineProviderProps } from './provider/MachineProvider';
export { VariableScope } from './provider/VariableScope';

// Hooks
export { useVariable } from './hooks/useVariable';
export { useWrite } from './hooks/useWrite';
export { useParent } from './hooks/useParent';
export type { ParentConfig } from './hooks/useParent';
export { useMachine } from './hooks/useMachine';
export type { MachineControls } from './hooks/useMachine';
export { useMomentary } from './hooks/useMomentary';
export { useCurrentUser } from './hooks/useCurrentUser';
export { useCurrentUserRoles } from './hooks/useCurrentUserRoles';
export type { MomentaryResult, MomentaryHandlers, MomentaryConfig } from './hooks/useMomentary';

// Mock (included in main bundle for test usage in consumer apps)
export { MockCommLayer } from './mock/MockCommLayer';
