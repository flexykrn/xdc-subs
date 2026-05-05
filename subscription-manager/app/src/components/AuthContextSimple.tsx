"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

interface AuthContextType {
  isAuthenticated: boolean;
  eoaAddress: string;
  smartAccountAddress: string;
  login: () => Promise<void>;
  logout: () => void;
  setUser: (user: { eoaAddress: string; smartAccountAddress: string }) => void;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  eoaAddress: "",
  smartAccountAddress: "",
  login: async () => {},
  logout: () => {},
  setUser: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [eoaAddress, setEoaAddress] = useState("");
  const [smartAccountAddress, setSmartAccountAddress] = useState("");

  const login = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      throw new Error("Please install MetaMask or XDCPay");
    }

    const accounts = await (window as any).ethereum.request({
      method: "eth_requestAccounts",
    });

    if (accounts?.[0]) {
      setEoaAddress(accounts[0]);
      // For simple mode, EOA = Smart Account address (no AA factory)
      // Or compute counterfactual if needed
      setSmartAccountAddress(accounts[0]);
      setIsAuthenticated(true);
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setEoaAddress("");
    setSmartAccountAddress("");
  }, []);

  const setUser = useCallback((user: { eoaAddress: string; smartAccountAddress: string }) => {
    setEoaAddress(user.eoaAddress);
    setSmartAccountAddress(user.smartAccountAddress);
    setIsAuthenticated(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        eoaAddress,
        smartAccountAddress,
        login,
        logout,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
