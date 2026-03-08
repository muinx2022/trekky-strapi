"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

type ProfilePayload = {
  bio?: string | null;
  avatar?: { url?: string | null; data?: { url?: string | null } | null } | null;
};

function toAbsoluteMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_URL}${url}`;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { isLoggedIn, user, updateProfile, openLoginModal, logout } = useAuth();
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isLoggedIn || !user) {
      openLoginModal();
      router.push("/");
      return;
    }

    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/profile-proxy", {
          headers: { Authorization: `Bearer ${user.jwt}` },
          cache: "no-store",
        });

        if (res.status === 401) {
          logout();
          openLoginModal();
          router.push("/");
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to fetch profile");
        }

        const payload = (await res.json()) as ProfilePayload;
        if (!active) {
          return;
        }

        setBio(payload.bio ?? user.bio ?? "");
        const avatarUrl = payload.avatar?.data?.url ?? payload.avatar?.url ?? user.avatarUrl ?? null;
        setAvatarPreview(toAbsoluteMediaUrl(avatarUrl));
      } catch {
        if (!active) {
          return;
        }

        setBio(user.bio ?? "");
        setAvatarPreview(user.avatarUrl ?? null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [isHydrated, isLoggedIn, user, openLoginModal, router, logout]);

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setAvatarFile(file);
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);

    const result = await updateProfile({ bio, avatarFile });
    setSaving(false);
    if (result) {
      setError(result);
      return;
    }

    setAvatarFile(null);
    setMessage("Cập nhật hồ sơ thành công.");
  };

  if (!isHydrated || !isLoggedIn || !user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-lg border border-gray-200 bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">Sửa thông tin cá nhân</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Cập nhật ảnh đại diện và giới thiệu.</p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Avatar</label>
          {avatarPreview && (
            <Image
              src={avatarPreview}
              alt="Avatar preview"
              width={96}
              height={96}
              className="h-24 w-24 rounded-full object-cover"
              unoptimized
            />
          )}
          <input
            type="file"
            accept="image/*"
            onChange={onAvatarChange}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
          <textarea
            name="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={4}
            className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {message && <p className="text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}
        {loading && <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải thông tin hồ sơ...</p>}

        <button
          type="submit"
          disabled={saving || loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Đang cập nhật..." : "Cập nhật hồ sơ"}
        </button>
      </form>
    </div>
  );
}
