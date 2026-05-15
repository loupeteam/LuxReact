import { OpcuaMachine } from 'lux-opcua';
import { connectionConfig } from './config';

/**
 * Single machine instance — created once at module level.
 * MachineProvider calls connect() on mount and disconnect() on unmount.
 */
export const machine = new OpcuaMachine(connectionConfig);
