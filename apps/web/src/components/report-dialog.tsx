"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "./auth-context";

type Props = {
  targetType: string;
  targetDocumentId: string;
};

const REPORT_CATEGORIES = [
  { value: "incorrect_info", label: "Thông tin không chính xác" },
  { value: "spam", label: "Spam / Quảng cáo" },
  { value: "harassment", label: "Quấy rối / Xúc phạm" },
  { value: "inappropriate", label: "Nội dung không phù hợp" },
  { value: "copyright", label: "Vi phạm bản quyền" },
  { value: "other", label: "Lý do khác" },
];

const lsKey = (type: string, docId: string) => `reported:${type}:${docId}`;

function readReportedFlag(targetType: string, targetDocumentId: string) {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return Boolean(localStorage.getItem(lsKey(targetType, targetDocumentId)));
  } catch {
    return false;
  }
}

export function ReportDialog({ targetType, targetDocumentId }: Props) {
  const { isLoggedIn, jwt, openLoginModal } = useAuth();
  const reportKey = lsKey(targetType, targetDocumentId);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("");
  const [reason, setReason] = useState("");
  const [serverReported, setServerReported] = useState<{ key: string; value: boolean }>({
    key: "",
    value: false,
  });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const backdropRef = useRef<HTMLDivElement>(null);
  const checkedRef = useRef(false);
  const localReported = useSyncExternalStore(
    () => () => {},
    () => readReportedFlag(targetType, targetDocumentId),
    () => false,
  );
  const alreadyReported = localReported || (serverReported.key === reportKey && serverReported.value);

  useEffect(() => {
    checkedRef.current = false;
  }, [reportKey]);

  useEffect(() => {
    if (!isLoggedIn || !jwt || checkedRef.current) return;

    checkedRef.current = true;
    fetch(
      `/api/report-proxy?targetType=${encodeURIComponent(targetType)}&targetDocumentId=${encodeURIComponent(targetDocumentId)}`,
      { headers: { Authorization: `Bearer ${jwt}` } },
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.data?.reported) {
          setServerReported({ key: reportKey, value: true });
          try {
            localStorage.setItem(reportKey, "1");
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // ignore
      });
  }, [isLoggedIn, jwt, reportKey, targetType, targetDocumentId]);

  useEffect(() => {
    if (!open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const resetDialogState = () => {
    setCategory("");
    setReason("");
    setStatus("idle");
  };

  const handleOpen = () => {
    if (!isLoggedIn || !jwt) {
      openLoginModal();
      return;
    }

    if (alreadyReported) {
      return;
    }

    resetDialogState();
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    resetDialogState();
  };

  const handleSubmit = async () => {
    if (!category) return;
    setStatus("loading");

    const categoryLabel = REPORT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
    const fullReason = reason.trim() ? `[${categoryLabel}] ${reason.trim()}` : `[${categoryLabel}]`;

    try {
      const res = await fetch("/api/report-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        body: JSON.stringify({ targetType, targetDocumentId, reason: fullReason }),
      });
      const data = await res.json();

      if (data?.data?.alreadyReported) {
        setServerReported({ key: reportKey, value: true });
        try {
          localStorage.setItem(reportKey, "1");
        } catch {
          // ignore
        }
        handleClose();
      } else if (res.ok) {
        setStatus("success");
        setServerReported({ key: reportKey, value: true });
        try {
          localStorage.setItem(reportKey, "1");
        } catch {
          // ignore
        }
        setTimeout(handleClose, 1800);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        disabled={alreadyReported}
        title={alreadyReported ? "Bạn đã báo cáo bài viết này" : "Báo cáo bài viết"}
        className={`flex items-center gap-2 text-sm font-medium transition-colors px-3 py-1.5 rounded-full ${
          alreadyReported
            ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
            : "text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
        }`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" x2="4" y1="22" y2="15" />
        </svg>
        {alreadyReported ? "Đã báo cáo" : "Báo cáo"}
      </button>

      {open && (
        <div
          ref={backdropRef}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === backdropRef.current) handleClose();
          }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          <div className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-6 animate-in fade-in zoom-in-95 duration-200 flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Báo cáo bài viết</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Nội dung vi phạm sẽ được đội ngũ kiểm duyệt xem xét.
                </p>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {status === "success" ? (
              <div className="flex flex-col items-center gap-3 py-6 text-green-600 dark:text-green-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <path d="m9 11 3 3L22 4" />
                </svg>
                <p className="text-sm font-medium">Báo cáo đã được gửi. Cảm ơn bạn.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Lý do báo cáo <span className="text-red-500">*</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {REPORT_CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={`text-left text-sm px-3 py-2 rounded-lg border transition-colors ${
                          category === cat.value
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium"
                            : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Chi tiết thêm <span className="text-zinc-400 font-normal">(tùy chọn)</span>
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Mô tả ngắn gọn vấn đề bạn phát hiện..."
                    rows={3}
                    maxLength={500}
                    className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 transition"
                  />
                  <div className="text-xs text-zinc-400 text-right">{reason.length}/500</div>
                </div>

                {status === "error" && (
                  <p className="text-sm text-red-500">Có lỗi xảy ra, vui lòng thử lại.</p>
                )}

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={handleClose}
                    className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!category || status === "loading"}
                    className="px-4 py-2 text-sm font-medium rounded-full bg-gray-500 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
                  >
                    {status === "loading" ? "Đang gửi..." : "Gửi báo cáo"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
