import { useEffect, useState } from 'react';
import { useResolvedContext } from './useResolvedContext';

/**
 * Returns the roles assigned to the currently authenticated user. Updates
 * reactively whenever the user changes (via changeUser or reconnect).
 *
 * Returns undefined when the comm layer does not support roles, when no
 * session is established, or before the first onUserChanged event arrives.
 * Returns `[]` for an authenticated session with no roles (e.g. anonymous
 * after logout).
 *
 * @param machineId Optional: look up a specific machine by id.
 */
export function useCurrentUserRoles(machineId?: string): string[] | undefined {
  const context = useResolvedContext(machineId);
  const commLayer = context?.commLayer;

  const [roles, setRoles] = useState<string[] | undefined>(
    () => commLayer?.getCurrentUserRoles?.(),
  );

  useEffect(() => {
    if (!commLayer?.onUserChanged) return;
    setRoles(commLayer.getCurrentUserRoles?.());
    // Roles change atomically with username on the server side, so we re-read
    // them whenever the user-changed event fires. No separate event needed.
    return commLayer.onUserChanged(() => {
      setRoles(commLayer.getCurrentUserRoles?.());
    }) ?? undefined;
  }, [commLayer]);

  return roles;
}
