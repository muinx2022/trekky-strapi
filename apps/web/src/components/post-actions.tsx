"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "./auth-context";
import { ReportDialog } from "./report-dialog";

type ActionProps = {
  targetType: string;
  targetDocumentId: string;
};

export function PostActions({ targetType, targetDocumentId }: ActionProps) {
  const { isLoggedIn, jwt, openLoginModal } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [followed, setFollowed] = useState(false);
  const [follows, setFollows] = useState(0);
  const [copied, setCopied] = useState(false);
  const loadedRef = useRef(false);

  // Load counts on mount (no auth needed)
  useEffect(() => {
    fetch(
      `/api/interaction-proxy?targetType=${encodeURIComponent(targetType)}&targetDocumentId=${encodeURIComponent(targetDocumentId)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setLikes(data.likesCount ?? 0);
        setFollows(data.followsCount ?? 0);
      })
      .catch(() => {/* ignore */});
  }, [targetType, targetDocumentId]);

  // Load user's like/follow state when logged in
  useEffect(() => {
    if (!isLoggedIn || !jwt || loadedRef.current) return;
    loadedRef.current = true;

    fetch(
      `/api/interaction-proxy?targetType=${encodeURIComponent(targetType)}&targetDocumentId=${encodeURIComponent(targetDocumentId)}`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    )
      .then((r) => r.json())
      .then((data) => {
        setLiked(!!data.liked);
        setFollowed(!!data.followed);
        setLikes(data.likesCount ?? 0);
        setFollows(data.followsCount ?? 0);
      })
      .catch(() => {/* ignore */});
  }, [isLoggedIn, jwt, targetType, targetDocumentId]);

  const toggleInteraction = async (actionType: "like" | "follow") => {
    if (!isLoggedIn || !jwt) { openLoginModal(); return; }

    const res = await fetch("/api/interaction-proxy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({ actionType, targetType, targetDocumentId }),
    }).catch(() => null);

    if (!res?.ok) return;
    const data = await res.json();
    const active: boolean = data?.data?.active ?? false;

    if (actionType === "like") {
      setLiked(active);
      setLikes((n) => active ? n + 1 : Math.max(0, n - 1));
    } else {
      setFollowed(active);
      setFollows((n) => active ? n + 1 : Math.max(0, n - 1));
    }
  };

  const handleLike = () => toggleInteraction("like");
  const handleFollow = () => toggleInteraction("follow");

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: do nothing
    }
  };

  return (
    <div className="flex flex-wrap gap-3 border-t border-b border-zinc-200 dark:border-zinc-800 py-4 mt-8">
      {/* Like */}
      <button
        onClick={handleLike}
        className={`flex items-center gap-2 text-sm font-medium transition-colors px-3 py-1.5 rounded-full ${
          liked
            ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
            : "text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
        Thích {likes > 0 && <span>({likes})</span>}
      </button>

      {/* Follow */}
      <button
        onClick={handleFollow}
        className={`flex items-center gap-2 text-sm font-medium transition-colors px-3 py-1.5 rounded-full ${
          followed
            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
            : "text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>
        {followed ? "Đang theo dõi" : "Theo dõi"} {follows > 0 && <span>({follows})</span>}
      </button>

      {/* Report */}
      <ReportDialog targetType={targetType} targetDocumentId={targetDocumentId} />

      {/* Share / Copy link */}
      <button
        onClick={handleShare}
        className={`flex items-center gap-2 text-sm font-medium transition-colors px-3 py-1.5 rounded-full ${
          copied
            ? "bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400"
            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        }`}
      >
        {copied ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
            Đã sao chép!
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
            Chia sẻ
          </>
        )}
      </button>
    </div>
  );
}
