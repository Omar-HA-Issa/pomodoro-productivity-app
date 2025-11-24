/* eslint-disable react-refresh/only-export-components */
import React, {
  createContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

interface User {
  id: string;
  email: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    email: string,
    password: string,
    metadata?: { first_name?: string; last_name?: string }
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined
);

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

type JwtPayload = {
  sub: string;
  email: string;
  created_at?: string;
};

function parseJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    return JSON.parse(atob(payload)) as JwtPayload;
  } catch {
    return null;
  }
}

interface AuthProviderProps {
  children: ReactNode;
}

async function parseResponse<T = any>(
  response: Response
): Promise<{ data: T | null; text: string }> {
  const text = await response.text();
  if (!text) return { data: null, text: "" };

  try {
    const data = JSON.parse(text) as T;
    return { data, text };
  } catch {
    return { data: null, text };
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      setLoading(false);
      return;
    }

    void checkAuth(token);
  }, []);

  const checkAuth = async (token: string): Promise<void> => {
    try {
      const response = await fetch(`${API_BASE}/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const payload = parseJwt(token);
        if (payload) {
          setUser({
            id: payload.sub,
            email: payload.email,
            created_at: payload.created_at ?? "",
          });
        } else {
          localStorage.removeItem("auth_token");
        }
      } else {
        localStorage.removeItem("auth_token");
      }
    } catch {
      localStorage.removeItem("auth_token");
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (
    email: string,
    password: string
  ): Promise<{ error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/auth/signin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const { data, text } = await parseResponse<{
        error?: string;
        session?: { access_token: string };
        user?: User;
      }>(response);

      if (!response.ok || !data?.session || !data?.user) {
        const msg =
          data?.error ||
          text ||
          (response.status === 401
            ? "Invalid email or password"
            : "Login failed");
        return { error: msg };
      }

      localStorage.setItem("auth_token", data.session.access_token);
      setUser(data.user);

      return {};
    } catch {
      return { error: "Network error. Please try again." };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    metadata?: { first_name?: string; last_name?: string }
  ): Promise<{ error?: string }> => {
    try {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name: metadata?.first_name,
          last_name: metadata?.last_name,
        }),
      });

      const { data, text } = await parseResponse<{ error?: string }>(
        response
      );

      if (!response.ok) {
        const msg =
          data?.error ||
          text ||
          (response.status === 400
            ? "Invalid signup data"
            : "Signup failed");
        return { error: msg };
      }

      // backend says: "Check email for confirmation"
      return {};
    } catch {
      return { error: "Network error. Please try again." };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      const token = localStorage.getItem("auth_token");
      if (token) {
        await fetch(`${API_BASE}/auth/signout`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (err) {
      console.error("Signout error:", err);
    } finally {
      localStorage.removeItem("auth_token");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
