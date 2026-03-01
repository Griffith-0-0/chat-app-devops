import axios from 'axios';

export const authAPI = axios.create({
  baseURL: import.meta.env.VITE_AUTH_URL,
});

export const profilesAPI = axios.create({
  baseURL: import.meta.env.VITE_PROFILES_URL,
});

export const messagesAPI = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

authAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

profilesAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

messagesAPI.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});