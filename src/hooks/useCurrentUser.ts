import { useEffect, useState } from 'react';
import { useResolvedContext } from './useResolvedContext';

/**
 * Returns the currently authenticated username, updating reactively whenever
 * the user changes (via changeUser or reconnect).
 *
 * Returns undefined when the comm layer does not support getCurrentUser,
 * or when no user is authenticated.
 *
 * @param machineId Optional: look up a specific machine by id.
 */
export function useCurrentUser(machineId?: string): string | undefined {
  const context = useResolvedContext(machineId);
  const commLayer = context?.commLayer;

  const [currentUser, setCurrentUser] = useState<string | undefined>(
    () => commLayer?.getCurrentUser?.(),
  );

  useEffect(() => {
    if (!commLayer?.onUserChanged) return;
    setCurrentUser(commLayer.getCurrentUser?.());
    return commLayer.onUserChanged(setCurrentUser) ?? undefined;
  }, [commLayer]);

  return currentUser;
}
