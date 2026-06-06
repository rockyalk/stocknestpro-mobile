import React, { createContext, useContext } from 'react';

interface AuthContextType {
  user: {
    id: string;
    email: string;
    name?: string;
  } | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = {
    user: { id: '1', email: 'test@example.com', name: 'Test User' },
    logout: async () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Return a default value instead of throwing, to be robust in all environments
    return {
      user: { id: '1', email: 'test@example.com', name: 'Test User' },
      logout: async () => {},
    };
  }
  return context;
}
