/**
 * Contexte d'authentification global
 * Expose user, token, login, register, logout. Persiste les tokens dans localStorage.
 * useAuth est dans ../hooks/useAuth.js (react-refresh/only-export-components).
 */
import { useState } from 'react';
import { authAPI } from '../api/axios';
import { AuthContext } from './auth-context';

function getUserFromToken(token) {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export const AuthProvider = ({ children }) => {
  const storedToken = localStorage.getItem('accessToken');
  const [user, setUser] = useState(() => getUserFromToken(storedToken));
  const [token, setToken] = useState(storedToken);

  const login = async (email, password) => {
    const res = await authAPI.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    setToken(res.data.accessToken);
    setUser(getUserFromToken(res.data.accessToken));
  };

  const register = async (username, email, password) => {
    await authAPI.post('/auth/register', { username, email, password });
  };

  const logout = async () => {
    try {
      await authAPI.post('/auth/logout');
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
