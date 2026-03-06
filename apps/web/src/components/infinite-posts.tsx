"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Post } from "@/lib/strapi";
import { PostCard } from "@/components/post-card";

export function InfinitePosts({
  initialPosts,
  initialTotal,
  categorySlug,
  tagSlug,
  authorUsername,
}: {
  initialPosts: Post[];
  initialTotal: number;
  categorySlug?: string;
  tagSlug?: string;
  authorUsername?: string;
}) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialPosts.length < initialTotal);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const nextPage = page + 1;
      let url = `/api/posts-proxy?page=${nextPage}`;
      if (categorySlug) url += `&category=${categorySlug}`;
      if (tagSlug) url += `&tag=${tagSlug}`;
      if (authorUsername) url += `&author=${authorUsername}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPosts((prev) => {
          const newPosts = [...prev, ...data.data];
          setHasMore(newPosts.length < data.meta.pagination.total);
          return newPosts;
        });
        setPage(nextPage);
      }
    } catch (error) {
      console.error("Failed to load more posts", error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, categorySlug, tagSlug, authorUsername]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard key={post.documentId} post={post} />
      ))}

      {posts.length === 0 && !loading && (
        <div className="text-center text-sm text-gray-500 py-8">Chưa có bài viết nào</div>
      )}

      <div ref={sentinelRef} className="h-4" />

      {loading && (
        <div className="flex justify-center py-4">
          <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <div className="text-center text-xs text-gray-400 py-4">Đã tải hết bài viết</div>
      )}
    </div>
  );
}
