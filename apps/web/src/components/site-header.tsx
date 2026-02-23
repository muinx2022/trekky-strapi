"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "./auth-context";

export function SiteHeader() {
  const { isLoggedIn, user, logout, openLoginModal } = useAuth();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!menuRef.current) {
        return;
      }
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const showUserMenu = isHydrated && isLoggedIn && !!user;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/90 shadow-sm backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="container mx-auto flex h-16 items-center justify-between gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 select-none items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
            M
          </div>
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">MyWeb</span>
        </Link>

        <div className="hidden max-w-sm flex-1 md:flex">
          <div className="relative w-full">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              placeholder="Tìm kiếm bài viết..."
              className="w-full rounded-full border border-zinc-200 bg-zinc-50 py-1.5 pl-9 pr-4 text-sm text-zinc-700 placeholder-zinc-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!isHydrated ? (
            <div className="h-8 w-[140px]" />
          ) : showUserMenu && user ? (
            <>
              <Link
                href="/my-posts/new"
                className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
              >
                Tạo bài viết
              </Link>

              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-2 py-1.5 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  onClick={() => setMenuOpen((current) => !current)}
                >
                  {user.avatarUrl ? (
                    <Image
                      key={user.avatarUrl}
                      src={user.avatarUrl}
                      alt="Avatar"
                      width={28}
                      height={28}
                      className="h-7 w-7 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold uppercase text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                      title={user.email}
                    >
                      {(user.username ?? user.email)[0]}
                    </div>
                  )}
                  <span className="hidden text-sm font-medium text-zinc-700 dark:text-zinc-300 sm:block">
                    {user.username}
                  </span>
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-950">
                    <Link
                      href="/my-posts/new"
                      className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() => setMenuOpen(false)}
                    >
                      Tạo bài viết
                    </Link>
                    <Link
                      href="/profile/edit"
                      className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() => setMenuOpen(false)}
                    >
                      Sửa hồ sơ
                    </Link>
                    <Link
                      href="/my-posts"
                      className="block px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      onClick={() => setMenuOpen(false)}
                    >
                      Bài viết của tôi
                    </Link>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                      router.push("/");
                    }}
                  >
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={openLoginModal}
              className="rounded-full bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              Đăng nhập
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
