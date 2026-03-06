export type AdminSession = {
  jwt: string;
  user: {
    id: number;
    username: string;
    email?: string;
    roleName?: string;
  };
};

const API_URL = "";
const SESSION_KEY = "starter_admin_session";
const REMEMBERED_IDENTIFIER_KEY = "starter_admin_identifier";

type AuthResponse = {
  jwt: string;
  user: {
    id: number;
    username: string;
    email?: string;
  };
};

type MeResponse = {
  id: number;
  username: string;
  email?: string;
  role?: {
    id: number;
    name: string;
    type?: string;
  };
};

export async function loginAsAdmin(identifier: string, password: string) {
  const authResponse = await fetch(`${API_URL}/api/auth/local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });

  const authPayload = (await authResponse.json()) as AuthResponse & {
    error?: { message?: string };
  };

  if (!authResponse.ok || !authPayload.jwt) {
    throw new Error(authPayload.error?.message ?? "Login failed");
  }

  const meResponse = await fetch(`${API_URL}/api/users/me?populate=role`, {
    headers: {
      Authorization: `Bearer ${authPayload.jwt}`,
      "Content-Type": "application/json",
    },
  });

  const mePayload = (await meResponse.json()) as MeResponse & {
    error?: { message?: string };
  };

  if (!meResponse.ok) {
    throw new Error(mePayload.error?.message ?? "Cannot read user profile");
  }

  // Probe an admin-only endpoint to validate effective admin access.
  // This avoids mismatches between role naming/grouping conventions.
  const probeResponse = await fetch(`${API_URL}/api/management/dashboard`, {
    headers: {
      Authorization: `Bearer ${authPayload.jwt}`,
      "Content-Type": "application/json",
    },
  });

  if (!probeResponse.ok) {
    throw new Error("User does not have Admin access");
  }

  return {
    jwt: authPayload.jwt,
    user: {
      id: mePayload.id,
      username: mePayload.username,
      email: mePayload.email,
      roleName: mePayload.role?.name,
    },
  } satisfies AdminSession;
}

export function getStoredSession(): AdminSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw =
    window.localStorage.getItem(SESSION_KEY) ??
    window.sessionStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AdminSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: AdminSession, rememberMe: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  const payload = JSON.stringify(session);
  if (rememberMe) {
    window.localStorage.setItem(SESSION_KEY, payload);
    window.sessionStorage.removeItem(SESSION_KEY);
    return;
  }

  window.sessionStorage.setItem(SESSION_KEY, payload);
  window.localStorage.removeItem(SESSION_KEY);
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}

export function getRememberedIdentifier() {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(REMEMBERED_IDENTIFIER_KEY) ?? "";
}

export function saveRememberedIdentifier(identifier: string, rememberMe: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  if (!rememberMe || !identifier.trim()) {
    window.localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
    return;
  }

  window.localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, identifier.trim());
}

