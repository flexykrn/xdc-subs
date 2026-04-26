"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

interface AuthContextType {
  isAuthenticated: boolean;
  eoaAddress: string;
  smartAccountAddress: string;
  nativeBalance: string;
  login: () => void;
  logout: () => void;
  setUser: (user: { eoaAddress: string; smartAccountAddress: string; nativeBalance: string }) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [eoaAddress, setEoaAddress] = useState("");
  const [smartAccountAddress, setSmartAccountAddress] = useState("");
  const [nativeBalance, setNativeBalance] = useState("");

  // Check for existing session on mount
  useEffect(() => {
    const saved = localStorage.getItem("aa-auth");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        if (data.isAuthenticated) {
          setIsAuthenticated(true);
          setEoaAddress(data.eoaAddress || "");
          setSmartAccountAddress(data.smartAccountAddress || "");
          setNativeBalance(data.nativeBalance || "");
        }
      } catch {
        localStorage.removeItem("aa-auth");
      }
    }
  }, []);

  // Persist auth state
  useEffect(() => {
    if (isAuthenticated) {
      localStorage.setItem("aa-auth", JSON.stringify({
        isAuthenticated,
        eoaAddress,
        smartAccountAddress,
        nativeBalance,
      }));
    }
  }, [isAuthenticated, eoaAddress, smartAccountAddress, nativeBalance]);

  const login = useCallback(() => {
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setEoaAddress("");
    setSmartAccountAddress("");
    setNativeBalance("");
    localStorage.removeItem("aa-auth");
  }, []);

  const setUser = useCallback((user: { eoaAddress: string; smartAccountAddress: string; nativeBalance: string }) => {
    setEoaAddress(user.eoaAddress);
    setSmartAccountAddress(user.smartAccountAddress);
    setNativeBalance(user.nativeBalance);
  }, []);

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      eoaAddress,
      smartAccountAddress,
      nativeBalance,
      login,
      logout,
      setUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
