"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { PropsWithChildren, useEffect, useMemo, useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  FileText,
  Tag,
  MessageSquare,
  Users,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { clearSession, type AdminSession } from "@/lib/admin-auth";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/categories", label: "Categories", icon: Tag },
  { href: "/comments", label: "Comments", icon: MessageSquare },
  { href: "/users", label: "Users", icon: Users },
];

const SESSION_KEY = "starter_admin_session";
let cachedSessionRaw: string | null | undefined;
let cachedSessionValue: AdminSession | null = null;

function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(/[@.\s_-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
      {initials || "A"}
    </div>
  );
}

function subscribeSession(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSessionSnapshot() {
  const raw =
    window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY);

  if (raw === cachedSessionRaw) {
    return cachedSessionValue;
  }

  cachedSessionRaw = raw;
  if (!raw) {
    cachedSessionValue = null;
    return cachedSessionValue;
  }

  try {
    cachedSessionValue = JSON.parse(raw) as AdminSession;
  } catch {
    cachedSessionValue = null;
  }

  return cachedSessionValue;
}

function getSessionServerSnapshot() {
  return undefined as AdminSession | null | undefined;
}

export function AdminProtectedLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSyncExternalStore<AdminSession | null | undefined>(
    subscribeSession,
    getSessionSnapshot,
    getSessionServerSnapshot,
  );

  useEffect(() => {
    if (session === null) {
      router.replace("/");
    }
  }, [router, session]);

  const activePath = useMemo(() => pathname ?? "", [pathname]);

  if (session === undefined || session === null) return null;

  const displayName = session.user.email ?? session.user.username;

  const onLogout = () => {
    clearSession();
    router.replace("/");
  };

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r bg-background">
        {/* Brand */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary shadow-sm">
            <span className="text-xs font-bold text-primary-foreground">A</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Starter Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Menu
          </p>
          <div className="space-y-0.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                activePath === item.href || activePath.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      isActive
                        ? "text-primary"
                        : "text-muted-foreground/70 group-hover:text-foreground"
                    }`}
                  />
                  {item.label}
                  {isActive && (
                    <ChevronRight className="ml-auto h-3.5 w-3.5 text-primary/50" />
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="shrink-0 border-t p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <UserAvatar name={displayName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{displayName}</p>
              <p className="text-[11px] text-muted-foreground">
                {session.user.roleName ?? "Admin"}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col pl-56">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-end border-b bg-background/80 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
