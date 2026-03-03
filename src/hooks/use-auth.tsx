import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AdminRole = "admin_owner" | "admin_manager" | null;

interface AuthContextType {
  username: string | null;
  role: AdminRole;
  loading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "admin_token";
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-login`;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<AdminRole>(null);
  const [loading, setLoading] = useState(true);

  const verifyToken = async (token: string) => {
    try {
      const res = await fetch(`${FUNCTIONS_URL}?action=verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("invalid");
      const data = await res.json();
      if (data.valid) {
        setUsername(data.sub);
        setRole(data.role as AdminRole);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      verifyToken(token);
    } else {
      setLoading(false);
    }
  }, []);

  const signIn = async (user: string, password: string) => {
    const res = await fetch(FUNCTIONS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao fazer login");
    localStorage.setItem(TOKEN_KEY, data.token);
    setUsername(data.username);
    setRole(data.role as AdminRole);
  };

  const signOut = () => {
    localStorage.removeItem(TOKEN_KEY);
    setUsername(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        username,
        role,
        loading,
        isAdmin: role === "admin_owner" || role === "admin_manager",
        isOwner: role === "admin_owner",
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
