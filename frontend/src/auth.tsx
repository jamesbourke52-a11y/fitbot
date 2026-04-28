import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "fitlux_token";

export type User = {
  id: string;
  email: string;
  name: string;
  has_completed_quiz?: boolean;
  role?: string;
};

export type SubscriptionStatus = {
  active: boolean;
  plan: string | null;
  access_until?: string | null;
};

type AuthCtx = {
  user: User | null;
  token: string | null;
  loading: boolean;
  subscription: SubscriptionStatus | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshSubscription: () => Promise<SubscriptionStatus | null>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  const fetchMe = async (t: string) => {
    const res = await fetch(`${BACKEND}/api/auth/me`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) throw new Error("auth failed");
    return (await res.json()) as User;
  };

  const fetchSubscription = async (t: string): Promise<SubscriptionStatus | null> => {
    try {
      const res = await fetch(`${BACKEND}/api/subscription/status`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return null;
      return (await res.json()) as SubscriptionStatus;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TOKEN_KEY);
        if (stored) {
          const me = await fetchMe(stored);
          const sub = await fetchSubscription(stored);
          setToken(stored);
          setUser(me);
          setSubscription(sub);
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAuth = async (path: string, body: any) => {
    const res = await fetch(`${BACKEND}/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Auth failed");
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    const sub = await fetchSubscription(data.token);
    setSubscription(sub);
  };

  const login = (email: string, password: string) => handleAuth("login", { email, password });
  const register = (name: string, email: string, password: string) =>
    handleAuth("register", { name, email, password });

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setSubscription(null);
  };

  const refreshUser = async () => {
    if (!token) return;
    const me = await fetchMe(token);
    setUser(me);
  };

  const refreshSubscription = async () => {
    if (!token) return null;
    const sub = await fetchSubscription(token);
    setSubscription(sub);
    return sub;
  };

  return (
    <Ctx.Provider value={{ user, token, loading, subscription, login, register, logout, refreshUser, refreshSubscription }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside provider");
  return c;
};

export const api = async (token: string | null, path: string, opts: RequestInit = {}) => {
  const res = await fetch(`${BACKEND}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Request failed");
  return data;
};
