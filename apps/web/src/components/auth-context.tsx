"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

type Media = {
  id?: number;
  url?: string | null;
};

type StrapiMe = {
  id: number;
  email: string;
  username: string;
  bio?: string | null;
  avatar?: unknown;
};

export type User = {
  id: number;
  email: string;
  username: string;
  bio?: string | null;
  avatarId?: number | null;
  avatarUrl?: string | null;
  avatarVersion?: number;
  jwt: string;
};

type AuthContextType = {
  user: User | null;
  isLoggedIn: boolean;
  jwt: string | null;
  /** Returns null on success, error message string on failure */
  login: (email: string, password: string, rememberMe: boolean) => Promise<string | null>;
  updateProfile: (input: { bio: string; avatarFile: File | null }) => Promise<string | null>;
  logout: () => void;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

function getMediaFromPayload(payload: unknown): Media | null {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload)) {
    return getMediaFromPayload(payload[0]);
  }

  if (typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    id?: number;
    url?: string;
    attributes?: { url?: string };
    data?: unknown;
  };

  if (record.data !== undefined) {
    return getMediaFromPayload(record.data);
  }

  const url = record.url ?? record.attributes?.url ?? null;
  if (!record.id && !url) {
    return null;
  }

  return { id: record.id, url };
}

function toAbsoluteMediaUrl(url?: string | null, version?: number | null) {
  if (!url) {
    return null;
  }

  const normalized = url.startsWith("http://") || url.startsWith("https://") ? url : `${API_URL}${url}`;
  if (!version) {
    return normalized;
  }

  return normalized.includes("?") ? `${normalized}&v=${version}` : `${normalized}?v=${version}`;
}

async function fetchCurrentUser(jwt: string): Promise<StrapiMe | null> {
  try {
    const meRes = await fetch(`${API_URL}/api/users/me?populate[avatar][fields][0]=url`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      cache: "no-store",
    });
    if (!meRes.ok) {
      return null;
    }
    const me = (await meRes.json()) as Partial<StrapiMe>;
    if (!me.id || !me.email || !me.username) {
      return null;
    }
    return me as StrapiMe;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const stored = localStorage.getItem("auth_user") || sessionStorage.getItem("auth_user");
    if (!stored) {
      return null;
    }

    try {
      const parsed = JSON.parse(stored) as Partial<User>;
      if (parsed.jwt && parsed.username && parsed.email) {
        return parsed as User;
      }
    } catch {
      // fall through and clear stale storage below
    }

    localStorage.removeItem("auth_user");
    sessionStorage.removeItem("auth_user");
    return null;
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const clearAuthState = useCallback(() => {
    setUser(null);
    localStorage.removeItem("auth_user");
    sessionStorage.removeItem("auth_user");
  }, []);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean): Promise<string | null> => {
      if (!email || !password) return "Vui lòng nhập email và mật khẩu.";

      let res: Response;
      try {
        res = await fetch(`${API_URL}/api/auth/local`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: email, password }),
        });
      } catch {
        return "Không thể kết nối đến máy chủ. Vui lòng thử lại.";
      }

      if (!res.ok) {
        try {
          const err = await res.json();
          // Strapi v5 error format: err.error.message
          const msg =
            err?.error?.message ||
            err?.message ||
            "Email hoặc mật khẩu không đúng.";
          return msg;
        } catch {
          return "Đăng nhập thất bại. Vui lòng thử lại.";
        }
      }

      const data = await res.json();
      const { jwt, user: strapiUser } = data as {
        jwt: string;
        user: StrapiMe;
      };

      const hydratedUser = (await fetchCurrentUser(jwt)) ?? strapiUser;
      const avatar = getMediaFromPayload(hydratedUser.avatar);
      const u: User = {
        id: hydratedUser.id,
        email: hydratedUser.email,
        username: hydratedUser.username,
        bio: hydratedUser.bio ?? null,
        avatarId: avatar?.id ?? null,
        avatarVersion: avatar?.id ?? 0,
        avatarUrl: toAbsoluteMediaUrl(avatar?.url, avatar?.id ?? null),
        jwt,
      };

      setUser(u);
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem("auth_user", JSON.stringify(u));
      setIsLoginModalOpen(false);
      return null;
    },
    []
  );

  const updateProfile = useCallback(
    async (input: { bio: string; avatarFile: File | null }): Promise<string | null> => {
      if (!user?.jwt) {
        return "Bạn chưa đăng nhập.";
      }

      let res: Response;
      try {
        const formData = new FormData();
        formData.append("bio", input.bio.trim());
        if (input.avatarFile) {
          formData.append("avatar", input.avatarFile);
        }

        res = await fetch("/api/profile-proxy", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${user.jwt}`,
          },
          body: formData,
        });
      } catch {
        return "Không thể cập nhật hồ sơ. Vui lòng thử lại.";
      }

      if (!res.ok) {
        if (res.status === 401) {
          clearAuthState();
          return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
        }
        try {
          const payload = await res.json();
          return payload?.error || payload?.message || "Cập nhật hồ sơ thất bại.";
        } catch {
          return "Cập nhật hồ sơ thất bại.";
        }
      }

      const payload = (await res.json()) as {
        id?: number;
        username?: string;
        email?: string;
        bio?: string | null;
        avatar?: unknown;
      };

      const avatar = getMediaFromPayload(payload.avatar);
      const nextAvatarVersion = input.avatarFile ? Date.now() : user.avatarVersion ?? avatar?.id ?? 0;
      const nextUser: User = {
        ...user,
        id: payload.id ?? user.id,
        username: payload.username ?? user.username,
        email: payload.email ?? user.email,
        bio: payload.bio ?? null,
        avatarId: avatar?.id ?? null,
        avatarVersion: nextAvatarVersion,
        avatarUrl: toAbsoluteMediaUrl(avatar?.url, nextAvatarVersion),
      };

      setUser(nextUser);

      const localStored = localStorage.getItem("auth_user");
      const sessionStored = sessionStorage.getItem("auth_user");
      if (localStored) {
        localStorage.setItem("auth_user", JSON.stringify(nextUser));
      }
      if (sessionStored) {
        sessionStorage.setItem("auth_user", JSON.stringify(nextUser));
      }

      return null;
    },
    [user, clearAuthState]
  );

  const logout = useCallback(() => {
    clearAuthState();
  }, [clearAuthState]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        jwt: user?.jwt ?? null,
        login,
        updateProfile,
        logout,
        isLoginModalOpen,
        openLoginModal: () => setIsLoginModalOpen(true),
        closeLoginModal: () => setIsLoginModalOpen(false),
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
