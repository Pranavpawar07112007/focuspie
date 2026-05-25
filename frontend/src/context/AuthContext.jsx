import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe, login as apiLogin, signup as apiSignup } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('focuspie_token'));
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  // Validate token on mount
  useEffect(() => {
    if (token) {
      getMe()
        .then((userData) => {
          setUser(userData);
          localStorage.setItem('focuspie_user', JSON.stringify(userData));
        })
        .catch((err) => {
          // Only clear token if unauthorized. Network errors should keep the token.
          if (err.response?.status === 401) {
            setToken(null);
            setUser(null);
            localStorage.removeItem('focuspie_token');
            localStorage.removeItem('focuspie_user');
          } else {
            // Optimistically assume user is logged in if network fails but token exists
            try {
              const savedUser = JSON.parse(localStorage.getItem('focuspie_user'));
              if (savedUser) setUser(savedUser);
            } catch (e) {}
          }
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  // Listen for forced logout from API interceptor
  useEffect(() => {
    const handleLogout = () => {
      setToken(null);
      setUser(null);
    };
    window.addEventListener('auth-logout', handleLogout);
    return () => window.removeEventListener('auth-logout', handleLogout);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await apiLogin({ username, password });
    localStorage.setItem('focuspie_token', data.access_token);
    localStorage.setItem('focuspie_user', JSON.stringify({ username: data.username }));
    setToken(data.access_token);
    setUser({ username: data.username });
    return data;
  }, []);

  const signup = useCallback(async (username, password) => {
    const data = await apiSignup({ username, password });
    localStorage.setItem('focuspie_token', data.access_token);
    localStorage.setItem('focuspie_user', JSON.stringify({ username: data.username }));
    setToken(data.access_token);
    setUser({ username: data.username });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('focuspie_token');
    localStorage.removeItem('focuspie_user');
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, isLoading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
