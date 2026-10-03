import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/endpoints';
import { TOKEN_KEY } from '../api/axiosInstance';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);

  const applySession = useCallback(({ token: newToken, user: newUser }) => {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setLoading(false);
      return undefined;
    }
    authApi
      .me()
      .then((res) => !cancelled && setUser(res.user))
      .catch(() => !cancelled && logout())
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onLogout = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('unfazed:logout', onLogout);
    return () => window.removeEventListener('unfazed:logout', onLogout);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isTherapist: user?.role === 'therapist',
      isClient: user?.role === 'client',
      login: async (body) => applySession(await authApi.login(body)),
      register: async (body) => applySession(await authApi.register(body)),
      clientLogin: async (body) => applySession(await authApi.clientLogin(body)),
      clientRegister: async (body) => applySession(await authApi.clientRegister(body)),
      acceptInvite: async (inviteToken, body) => applySession(await authApi.acceptInvite(inviteToken, body)),
      refreshUser: async () => {
        const res = await authApi.me();
        setUser(res.user);
        return res.user;
      },
      setUser,
      logout,
    }),
    [user, token, loading, applySession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
