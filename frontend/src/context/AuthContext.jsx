import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { authAPI } from '../services/api';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(
    JSON.parse(localStorage.getItem('user')) || null
  );
  const [token, setToken] = useState(
    localStorage.getItem('token') || null
  );

  const login = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', tokenData);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  // On every app load, verify token is still valid with backend
  useEffect(() => {
    const verifyToken = async () => {
      if (!token) return; // No token = not logged in, skip

      try {
        const res = await authAPI.getMe();
        setUser(res.data.data); // Refresh user data from backend
      } catch (err) {

 // Token expired or invalid — force logout
 console.error('Token verification failed:', err.message);
        logout();
      }
    };

    verifyToken();
  }, []); // Empty array = runs once when app first loads

  // Memoize so context value object isn't recreated on every render
const contextValue = useMemo(
  () => ({ user, token, login, logout }),
  [user, token] // Only recreate when user or token changes
);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook so any component can just write: const { user, login, logout } = useAuth()
export const useAuth = () => useContext(AuthContext);