import React, { createContext, useContext, useState, useEffect } from "react";

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
}

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isProfileComplete: boolean;
  login: (email: string, password: string) => boolean;
  signup: (email: string, password: string) => boolean;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("chat_user");
    if (stored) {
      setUser(JSON.parse(stored));
      setIsAuthenticated(true);
    }
  }, []);

  const login = (email: string, _password: string) => {
    const stored = localStorage.getItem("chat_accounts");
    const accounts = stored ? JSON.parse(stored) : {};
    if (accounts[email]) {
      const profile = accounts[email].profile;
      setUser(profile);
      setIsAuthenticated(true);
      localStorage.setItem("chat_user", JSON.stringify(profile));
      return true;
    }
    return false;
  };

  const signup = (email: string, _password: string) => {
    const stored = localStorage.getItem("chat_accounts");
    const accounts = stored ? JSON.parse(stored) : {};
    if (accounts[email]) return false;
    const profile: UserProfile = { name: "", email, avatar: "" };
    accounts[email] = { password: _password, profile };
    localStorage.setItem("chat_accounts", JSON.stringify(accounts));
    setUser(profile);
    setIsAuthenticated(true);
    localStorage.setItem("chat_user", JSON.stringify(profile));
    return true;
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem("chat_user");
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!user) return;
    const updated = { ...user, ...updates };
    setUser(updated);
    localStorage.setItem("chat_user", JSON.stringify(updated));
    const stored = localStorage.getItem("chat_accounts");
    const accounts = stored ? JSON.parse(stored) : {};
    if (accounts[updated.email]) {
      accounts[updated.email].profile = updated;
      localStorage.setItem("chat_accounts", JSON.stringify(accounts));
    }
  };

  const isProfileComplete = !!(user?.name && user?.avatar);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isProfileComplete, login, signup, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
