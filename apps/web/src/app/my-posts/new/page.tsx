"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { PostForm } from "@/components/post-form";

export default function NewMyPostPage() {
  const router = useRouter();
  const { isLoggedIn, jwt, openLoginModal } = useAuth();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (!isLoggedIn || !jwt) {
      openLoginModal();
      router.push("/");
    }
  }, [isHydrated, isLoggedIn, jwt, openLoginModal, router]);

  if (!isHydrated || !isLoggedIn || !jwt) {
    return null;
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-zinc-100 px-6 py-6 shadow-sm dark:border-zinc-800 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 sm:text-3xl">Tạo bài viết</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Viết và đăng bản nháp bài viết mới của bạn.</p>
      </section>
      <PostForm mode="create" jwt={jwt} />
    </div>
  );
}
