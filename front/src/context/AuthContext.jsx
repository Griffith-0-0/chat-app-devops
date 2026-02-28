import { createContext, useContext, useState } from 'react';
import { authAPI } from '../api/axios';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('accessToken'));

  const login = async (email, password) => {
    const res = await authAPI.post('/auth/login', { email, password });
    localStorage.setItem('accessToken', res.data.accessToken);
    localStorage.setItem('refreshToken', res.data.refreshToken);
    setToken(res.data.accessToken);
    const payload = JSON.parse(atob(res.data.accessToken.split('.')[1]));
    setUser({ userId: payload.userId });
  };

  const register = async (username, email, password) => {
    await authAPI.post('/auth/register', { username, email, password });
  };

  const logout = async () => {
    await authAPI.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);