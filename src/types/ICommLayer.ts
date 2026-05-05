import type { ConnectionState } from './ConnectionState';
import type {
	SubscriptionHandle,
	UnsubscribeFn,
	SubscribeOptions,
} from './VariableTypes';

/**
 * Generic communication contract for LuxReact.
 *
 * This shape is intentionally compatible with OpcuaMachine-style APIs while
 * remaining transport-agnostic for other communication libraries.
 */
export interface ICommLayer {
	readonly connectionState: ConnectionState | string;

	connect(): Promise<void>;
	disconnect(): Promise<void>;

	readVariable(path: string): Promise<unknown>;
	writeVariable(path: string, value: unknown): Promise<void>;

	/**
	 * Supports both async and sync handle styles so direct OpcuaMachine usage and
	 * in-memory test doubles are both compatible.
	 */
	subscribe(
		path: string,
		callback: (value: unknown) => void,
		options?: SubscribeOptions | number,
	): SubscriptionHandle | Promise<SubscriptionHandle>;

	unsubscribe(handle: SubscriptionHandle): void | Promise<void>;

	/**
	 * Accept either method spelling used by communication libraries.
	 * Implementations may return an unsubscribe function or void.
	 */
	onConnectionStateChanged?(
		handler: (state: ConnectionState | string) => void,
	): UnsubscribeFn | void;
	onConnectionStateChange?(
		handler: (state: ConnectionState | string) => void,
	): UnsubscribeFn | void;

	// Optional capabilities surfaced through useMachine() when present.
	changeUser?(username: string, password: string): Promise<void>;
	writeMany?(values: Record<string, unknown>): Promise<void>;
	getCurrentUser?(): string | undefined;
	/**
	 * Roles assigned to the currently authenticated user, as returned by
	 * the underlying server (OPC-UA mapp Connect populates this on
	 * authenticate / changeUser). Returns undefined when the comm layer
	 * does not support roles.
	 */
	getCurrentUserRoles?(): string[] | undefined;
	onUserChanged?(handler: (username: string | undefined) => void): UnsubscribeFn | void;
}
