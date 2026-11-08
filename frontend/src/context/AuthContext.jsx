import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

const TOKEN_KEY = 'amwaj_token';
const USER_KEY = 'amwaj_user';

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  // Restore user immediately from localStorage so UI stays logged-in across reloads/days
  const [user, setUser] = useState(() => loadStoredUser());
  const [loading, setLoading] = useState(true);

  const persist = useCallback((token, userData) => {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    if (userData) {
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setUser(userData);
    }
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // Validate token with server on startup; keep session if still valid
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      clearSession();
      setLoading(false);
      return;
    }

    api
      .me()
      .then((data) => {
        // Server confirms session — refresh stored user
        persist(token, data.user);
      })
      .catch(() => {
        // Token expired or invalid — force login
        clearSession();
      })
      .finally(() => setLoading(false));
  }, [persist, clearSession]);

  const login = async (username, password) => {
    const data = await api.login(username, password);
    persist(data.token, data.user);
    return data.user;
  };

  const logout = () => {
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
