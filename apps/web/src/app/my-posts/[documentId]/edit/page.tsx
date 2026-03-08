"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { PostForm } from "@/components/post-form";

export default function EditMyPostPage() {
  const router = useRouter();
  const params = useParams<{ documentId: string }>();
  const documentId = String(params?.documentId ?? "").trim();
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
      <section className="overflow-hidden rounded-lg border border-gray-200 bg-white px-6 py-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 sm:text-3xl">Sửa bài viết</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Cập nhật nội dung của bạn.</p>
      </section>
      <PostForm mode="edit" documentId={documentId} jwt={jwt} />
    </div>
  );
}
