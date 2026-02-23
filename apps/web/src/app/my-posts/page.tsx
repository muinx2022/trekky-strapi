"use client";

import { type ReactNode, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-context";
import { MyPostRowCard } from "@/components/my-post-row-card";
import { Post } from "@/lib/strapi";

type Pagination = {
  page: number;
  pageSize: number;
  pageCount: number;
  total: number;
};

type MyPostRow = Post & {
  status?: "draft" | "published";
};

function IconTooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="pointer-events-none absolute -top-9 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-zinc-900 px-2 py-1 text-[11px] text-white shadow group-hover:block dark:bg-zinc-100 dark:text-zinc-900">
      {label}
      {children}
    </span>
  );
}

export default function MyPostsPage() {
  const router = useRouter();
  const { isLoggedIn, jwt, openLoginModal } = useAuth();
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [rows, setRows] = useState<MyPostRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPublishPost, setPendingPublishPost] = useState<MyPostRow | null>(null);

  const load = useCallback(async () => {
    if (!jwt) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/my-posts-proxy?page=${page}&pageSize=10`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: MyPostRow[];
        meta?: { pagination?: Pagination };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || "Failed to load posts");
      }
      setRows(payload.data ?? []);
      setPagination(
        payload.meta?.pagination ?? { page, pageSize: 10, pageCount: 1, total: payload.data?.length ?? 0 },
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [jwt, page]);

  const onToggleStatus = async (item: MyPostRow) => {
    if (!jwt) {
      return;
    }

    const isPublished = item.status === "published" || Boolean(item.publishedAt);
    if (!isPublished) {
      setPendingPublishPost(item);
      return;
    }

    await executeToggleStatus(item);
  };

  const executeToggleStatus = async (item: MyPostRow) => {
    if (!jwt) {
      return;
    }

    setError(null);

    try {
      const res = await fetch("/api/my-posts-proxy", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          documentId: item.documentId,
          action: "toggle",
          currentStatus: item.status ?? (item.publishedAt ? "published" : "draft"),
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        data?: MyPostRow;
        error?: string;
      };

      if (!res.ok || !payload.data) {
        throw new Error(payload.error || "Không đổi được trạng thái");
      }

      setRows((prev) =>
        prev.map((row) => (row.documentId === item.documentId ? { ...row, ...payload.data } : row)),
      );
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Không đổi được trạng thái");
    }
  };

  useEffect(() => {
    if (!isHydrated) {
      return;
    }
    if (!isLoggedIn || !jwt) {
      openLoginModal();
      router.push("/");
      return;
    }
    void load();
  }, [isHydrated, isLoggedIn, jwt, openLoginModal, router, load]);

  if (!isHydrated || !isLoggedIn || !jwt) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Bài viết của tôi</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Quản lý và chỉnh sửa bài viết của bạn</p>
        </div>
        <Link
          href="/my-posts/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Tạo bài mới
        </Link>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      {pendingPublishPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Xác nhận xuất bản</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              Bạn có chắc chắn muốn xuất bản bài viết{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                &quot;{pendingPublishPost.title}&quot;
              </span>
              ?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={() => setPendingPublishPost(null)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                onClick={async () => {
                  const post = pendingPublishPost;
                  setPendingPublishPost(null);
                  if (post) {
                    await executeToggleStatus(post);
                  }
                }}
              >
                Xuất bản
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-zinc-600 dark:text-zinc-400">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-sm">Đang tải...</span>
          </div>
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 py-12 dark:border-zinc-800 dark:bg-zinc-900/50">
          <svg className="h-12 w-12 text-zinc-400 dark:text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="mt-4 text-sm font-medium text-zinc-700 dark:text-zinc-300">Chưa có bài viết nào</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">Bắt đầu bằng cách tạo bài viết đầu tiên của bạn</p>
          <Link
            href="/my-posts/new"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tạo bài viết
          </Link>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {rows.map((post) => (
              <div key={post.documentId} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <div className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <MyPostRowCard post={post} />
                  </div>
                  <div className="flex shrink-0 items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => onToggleStatus(post)}
                      className="group relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      title={post.status === "published" || post.publishedAt ? "Gỡ xuất bản" : "Xuất bản"}
                      aria-label={post.status === "published" || post.publishedAt ? "Gỡ xuất bản" : "Xuất bản"}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {post.status === "published" || post.publishedAt ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        )}
                      </svg>
                      <IconTooltip label={post.status === "published" || post.publishedAt ? "Gỡ xuất bản" : "Xuất bản"}>
                        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45 bg-zinc-900 dark:bg-zinc-100"></span>
                      </IconTooltip>
                    </button>
                    <Link
                      href={`/my-posts/${post.documentId}/edit`}
                      className="group relative inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-700"
                      title="Chỉnh sửa"
                      aria-label="Chỉnh sửa"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      <IconTooltip label="Chỉnh sửa">
                        <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45 bg-zinc-900 dark:bg-zinc-100"></span>
                      </IconTooltip>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {pagination.pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Trang {pagination.page} / {pagination.pageCount} <span className="text-zinc-400">•</span> Tổng: {pagination.total} bài viết
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Trước
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  disabled={page >= pagination.pageCount || loading}
                  onClick={() => setPage((current) => Math.min(pagination.pageCount, current + 1))}
                >
                  Sau
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
