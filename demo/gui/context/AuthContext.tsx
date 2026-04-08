import { createContext, useCallback, useContext, useState } from 'react';
import { useMachine } from 'lux-react';

interface AuthState {
  user: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  canChangeUser: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

// Username used for the "logged out" / view-only state.
// Adjust to match your PLC's anonymous/view account.
const GUEST_USER = 'view';
const GUEST_PASS = '1';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { changeUser } = useMachine();
  const [user, setUser] = useState<string | null>(null);

  const login = useCallback(async (username: string, password: string) => {
    if (!username.trim()) throw new Error('Username is required');
    if (changeUser) {
      await changeUser(username.trim(), password);
    }
    setUser(username.trim());
  }, [changeUser]);

  const logout = useCallback(async () => {
    if (changeUser) {
      await changeUser(GUEST_USER, GUEST_PASS);
    }
    setUser(null);
  }, [changeUser]);

  return (
    <AuthContext.Provider value={{ user, login, logout, canChangeUser: !!changeUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
