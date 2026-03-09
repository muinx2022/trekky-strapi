"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { PostForm } from "@/components/post-form";

export default function NewMyPostPage() {
  const router = useRouter();
  const { isLoggedIn, jwt, openLoginModal } = useAuth();
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

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
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">Tạo bài viết</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Viết và đăng bản nháp bài viết mới của bạn.</p>
      </section>
      <PostForm mode="create" jwt={jwt} />
    </div>
  );
}
