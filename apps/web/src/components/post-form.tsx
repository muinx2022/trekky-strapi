"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react";
import { TiptapEditor } from "@/components/tiptap-editor";
import { TagCombobox, type TagComboboxHandle, type TagOption } from "@/components/tag-combobox";
import { nameGalleryFile, nameContentFile } from "@/lib/media-naming";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";
const MAX_WIDTH = 1280;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB
const MAX_VIDEO_WIDTH = 1280;
const MAX_VIDEO_DURATION = 60; // seconds (inline editor only)

type CategoryItem = {
  id: number;
  documentId: string;
  name: string;
  sortOrder?: number;
  parent?: { id?: number; documentId?: string } | null;
};

type CategoryTreeOption = {
  value: string;
  label: string;
  depth: number;
};

type ExistingMedia = {
  id: number;
  url: string;
  mime?: string | null;
  alternativeText?: string | null;
};

async function resizeToMaxWidth(file: File, maxWidth: number): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const needsResize = img.naturalWidth > maxWidth;
      const w = needsResize ? maxWidth : img.naturalWidth;
      const h = needsResize ? Math.round(img.naturalHeight * (maxWidth / img.naturalWidth)) : img.naturalHeight;
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
      const quality = outputType === "image/jpeg" ? 0.85 : undefined;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          // Only use compressed version if it's actually smaller
          if (blob.size >= file.size && !needsResize) { resolve(file); return; }
          const ext = outputType === "image/jpeg" ? ".jpg" : ".png";
          const name = file.name.replace(/\.[^.]+$/, ext);
          resolve(new File([blob], name, { type: outputType }));
        },
        outputType,
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function processVideo(file: File): Promise<File> {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0;pointer-events:none;width:1px;height:1px";
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    container.appendChild(videoEl);
    document.body.appendChild(container);

    const cleanup = () => {
      try { document.body.removeChild(container); } catch { /* noop */ }
      URL.revokeObjectURL(videoEl.src);
    };

    videoEl.onloadedmetadata = () => {
      const needsTrim = videoEl.duration > MAX_VIDEO_DURATION;
      const needsResize = videoEl.videoWidth > MAX_VIDEO_WIDTH;

      if (!needsTrim && !needsResize) {
        cleanup();
        resolve(file);
        return;
      }

      const targetDur = Math.min(videoEl.duration, MAX_VIDEO_DURATION);
      const scale = needsResize ? MAX_VIDEO_WIDTH / videoEl.videoWidth : 1;
      const w = Math.round(videoEl.videoWidth * scale);
      const h = Math.round(videoEl.videoHeight * scale);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { cleanup(); resolve(file); return; }

      if (typeof canvas.captureStream !== "function") {
        cleanup();
        resolve(file);
        return;
      }

      const canvasStream = canvas.captureStream(30);

      // Try to capture audio from video element (works in user-gesture context like onSubmit)
      try {
        const videoStream = (videoEl as unknown as { captureStream?: () => MediaStream }).captureStream?.();
        videoStream?.getAudioTracks().forEach((t) => canvasStream.addTrack(t));
      } catch { /* no audio — ok */ }

      const mimeType =
        (["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"] as const).find((m) =>
          MediaRecorder.isTypeSupported(m),
        ) ?? "video/webm";

      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 2_500_000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        cleanup();
        const blob = new Blob(chunks, { type: mimeType });
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".webm"), { type: mimeType }));
      };

      recorder.start(200);
      videoEl.currentTime = 0;

      let animId = 0;
      const drawLoop = () => {
        if (videoEl.currentTime >= targetDur || videoEl.ended) {
          cancelAnimationFrame(animId);
          recorder.stop();
          canvasStream.getTracks().forEach((t) => t.stop());
          return;
        }
        ctx.drawImage(videoEl, 0, 0, w, h);
        animId = requestAnimationFrame(drawLoop);
      };

      const startPlay = () => {
        videoEl.play()
          .then(() => { drawLoop(); })
          .catch(() => {
            // Autoplay blocked — try muted fallback (loses audio)
            videoEl.muted = true;
            videoEl.play()
              .then(() => { drawLoop(); })
              .catch(() => { cleanup(); resolve(file); });
          });
      };

      startPlay();
    };

    videoEl.onerror = () => { cleanup(); resolve(file); };
    videoEl.src = URL.createObjectURL(file);
  });
}

function MultiSelectBox({
  options,
  value,
  onChange,
  placeholder = "Chọn danh mục",
}: {
  options: CategoryTreeOption[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedItems = useMemo(
    () => options.filter((item) => value.includes(item.value)),
    [options, value],
  );

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
      setOpen(false);
      return;
    }
    onChange([...value, optionValue]);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent | TouchEvent) => {
      if (!(e.target instanceof Node)) return;
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        onClick={() => setOpen((c) => !c)}
      >
        <span className="flex flex-1 flex-wrap items-center gap-1 text-left">
          {selectedItems.length === 0 && (
            <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
          )}
          {selectedItems.map((item) => (
            <span
              key={item.value}
              className="inline-flex items-center gap-1 rounded bg-gray-200 px-2 py-1 text-xs text-gray-800 dark:bg-gray-600 dark:text-gray-100"
            >
              {item.label}
              <span
                role="button"
                aria-label={`Remove ${item.label}`}
                className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-gray-300 dark:hover:bg-gray-500"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(value.filter((v) => v !== item.value));
                }}
              >
                <X className="h-3 w-3" />
              </span>
            </span>
          ))}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-gray-200 bg-white p-1 shadow-md dark:border-gray-700 dark:bg-gray-800">
          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => toggleOption(option.value)}
                style={{ paddingLeft: `${8 + option.depth * 16}px` }}
              >
                <span>{option.label}</span>
                {checked && <Check className="h-4 w-4" />}
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-gray-500 dark:text-gray-400">Chưa có danh mục</p>
          )}
        </div>
      )}
    </div>
  );
}

type PostFormProps = {
  mode: "create" | "edit";
  documentId?: string;
  jwt: string;
};

export function PostForm({ mode, documentId, jwt }: PostFormProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"content" | "images">("content");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showToolbar, setShowToolbar] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPost, setLoadingPost] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategoryDocumentIds, setSelectedCategoryDocumentIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);
  const tagComboboxRef = useRef<TagComboboxHandle>(null);
  const [error, setError] = useState<string | null>(null);

  // Media gallery tab
  const [existingMedia, setExistingMedia] = useState<ExistingMedia[]>([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<Set<number>>(new Set());
  const [newMediaFiles, setNewMediaFiles] = useState<File[]>([]);
  const [newMediaPreviews, setNewMediaPreviews] = useState<string[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [processingGallery, setProcessingGallery] = useState(false);
  const [processingMedia, setProcessingMedia] = useState(false);
  const [mediaMenuOpen, setMediaMenuOpen] = useState(false);
  const mediaMenuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraFileInputRef = useRef<HTMLInputElement>(null);
  // Pending content media: blob URL → File (for inline editor media)
  const pendingMediaMap = useRef<Map<string, File>>(new Map());

  useEffect(() => {
    const urls = newMediaFiles.map((f) => URL.createObjectURL(f));
    setNewMediaPreviews(urls);
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [newMediaFiles]);

  const categoryTreeOptions = useMemo(() => {
    const byParent = new Map<string | null, CategoryItem[]>();
    for (const item of categories) {
      const key = item.parent?.documentId ?? null;
      const bucket = byParent.get(key) ?? [];
      bucket.push(item);
      byParent.set(key, bucket);
    }
    for (const bucket of byParent.values()) {
      bucket.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    const flattened: CategoryTreeOption[] = [];
    const visit = (parentId: string | null, level: number) => {
      for (const node of byParent.get(parentId) ?? []) {
        flattened.push({ value: node.documentId, label: node.name, depth: level });
        visit(node.documentId, level + 1);
      }
    };
    visit(null, 0);
    return flattened;
  }, [categories]);

  // Load categories
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoadingCategories(true);
      try {
        const query = new URLSearchParams({
          sort: "sortOrder:asc",
          "fields[0]": "id",
          "fields[1]": "documentId",
          "fields[2]": "name",
          "fields[3]": "sortOrder",
          "populate[parent][fields][0]": "id",
          "populate[parent][fields][1]": "documentId",
          "pagination[page]": "1",
          "pagination[pageSize]": "1000",
        });
        const res = await fetch(`${API_URL}/api/categories?${query.toString()}`, { cache: "no-store" });
        const payload = (await res.json().catch(() => ({}))) as { data?: CategoryItem[] };
        if (active) setCategories(payload.data ?? []);
      } catch {
        // ignore
      } finally {
        if (active) setLoadingCategories(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  // Load post (edit mode)
  useEffect(() => {
    if (mode !== "edit" || !documentId) return;
    let active = true;
    const load = async () => {
      setLoadingPost(true);
      try {
        const res = await fetch(`/api/my-posts-proxy?documentId=${encodeURIComponent(documentId)}`, {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => ({}))) as {
          data?: {
            title?: string;
            content?: string;
            categories?: Array<{ documentId?: string }>;
            tags?: Array<{ documentId?: string; name?: string }>;
            images?: Array<{ id?: number; url?: string; mime?: string | null; alternativeText?: string | null }>;
          };
          error?: string;
        };
        if (!res.ok || !payload.data) throw new Error(payload.error || "Không tải được bài viết");
        if (!active) return;
        setTitle(payload.data.title ?? "");
        setContent(payload.data.content ?? "");
        setSelectedCategoryDocumentIds(
          (payload.data.categories ?? []).map((c) => String(c.documentId ?? "").trim()).filter(Boolean),
        );
        setSelectedTags(
          (payload.data.tags ?? [])
            .filter((t): t is { documentId: string; name?: string } => !!t.documentId)
            .map((t) => ({ documentId: t.documentId, name: t.name ?? "" })),
        );
        setExistingMedia(
          (payload.data.images ?? [])
            .filter((img) => img.id && img.url)
            .map((img) => ({ id: img.id!, url: img.url!, mime: img.mime, alternativeText: img.alternativeText })),
        );
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Không tải được bài viết");
      } finally {
        if (active) setLoadingPost(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [mode, documentId, jwt]);

  const visibleExistingMedia = existingMedia.filter((img) => !removedMediaIds.has(img.id));
  const totalMediaCount = visibleExistingMedia.length + newMediaFiles.length;

  useEffect(() => {
    if (!mediaMenuOpen) return;
    const handle = (e: MouseEvent) => {
      if (e.target instanceof Element && !mediaMenuRef.current?.contains(e.target)) setMediaMenuOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [mediaMenuOpen]);

  const handleMediaPicked = useCallback((blobUrl: string, file: File) => {
    pendingMediaMap.current.set(blobUrl, file);
  }, []);

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const allFiles = Array.from(event.target.files ?? []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraFileInputRef.current) cameraFileInputRef.current.value = "";

    const oversized = allFiles.filter((f) =>
      (f.type.startsWith("image/") && f.size > MAX_IMAGE_SIZE) ||
      (f.type.startsWith("video/") && f.size > MAX_VIDEO_SIZE),
    );
    if (oversized.length > 0) {
      setError(`Ảnh tối đa ${MAX_IMAGE_SIZE / 1024 / 1024}MB, video tối đa ${MAX_VIDEO_SIZE / 1024 / 1024}MB`);
    }

    const valid = allFiles.filter((f) =>
      (f.type.startsWith("image/") && f.size <= MAX_IMAGE_SIZE) ||
      (f.type.startsWith("video/") && f.size <= MAX_VIDEO_SIZE),
    );
    if (valid.length === 0) return;

    setProcessingGallery(true);
    try {
      const processed = await Promise.all(
        valid.map(async (f) => {
          const renamed = nameGalleryFile(f);
          return f.type.startsWith("image/") ? resizeToMaxWidth(renamed, MAX_WIDTH) : renamed;
        }),
      );
      setNewMediaFiles((prev) => [...prev, ...processed]);
    } finally {
      setProcessingGallery(false);
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Commit any pending tag text before submitting
    await tagComboboxRef.current?.commitPending();
    setSubmitting(true);
    setError(null);

    try {
      // Step 1: Upload gallery media (new files)
      let newUploadedIds: number[] = [];
      if (newMediaFiles.length > 0) {
        setUploadingMedia(true);
        const formData = new FormData();
        for (const file of newMediaFiles) {
          formData.append("files", file, file.name);
        }
        const uploadRes = await fetch("/api/upload-proxy", {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
          body: formData,
        });
        setUploadingMedia(false);
        const uploadPayload = (await uploadRes.json().catch(() => [])) as Array<{ id?: number }>;
        if (!uploadRes.ok) throw new Error("Tải media lên thất bại");
        newUploadedIds = uploadPayload.map((img) => img.id).filter((id): id is number => typeof id === "number");
      }

      // Step 2: Process and upload content inline media (blob URLs)
      let submittableContent = content;
      const blobMatches = [
        ...new Set([...submittableContent.matchAll(/blob:[^"'\s)>]+/g)].map((m) => m[0])),
      ];
      const mediaEntries = blobMatches
        .map((url) => [url, pendingMediaMap.current.get(url)] as [string, File | undefined])
        .filter((e): e is [string, File] => !!e[1]);

      if (mediaEntries.length > 0) {
        setUploadingMedia(true);
        const formData = new FormData();
        const processedFiles: File[] = [];

        for (const [, file] of mediaEntries) {
          let processed = file;
          if (file.type.startsWith("image/")) {
            processed = await resizeToMaxWidth(file, MAX_WIDTH);
          } else if (file.type.startsWith("video/")) {
            setProcessingMedia(true);
            processed = await processVideo(file);
            setProcessingMedia(false);
          }
          const named = nameContentFile(processed);
          processedFiles.push(named);
          formData.append("files", named, named.name);
        }

        const uploadRes = await fetch("/api/upload-proxy", {
          method: "POST",
          headers: { Authorization: `Bearer ${jwt}` },
          body: formData,
        });
        setUploadingMedia(false);
        if (!uploadRes.ok) throw new Error("Tải media lên thất bại");

        const uploadPayload = (await uploadRes.json().catch(() => [])) as Array<{ url?: string }>;
        for (let i = 0; i < mediaEntries.length; i++) {
          const [blobUrl] = mediaEntries[i];
          const url = uploadPayload[i]?.url;
          if (url) {
            const fullUrl = url.startsWith("http") ? url : `${API_URL}${url}`;
            submittableContent = submittableContent.replaceAll(blobUrl, fullUrl);
          }
        }
      }

      // Step 3: Submit post
      const imageIds =
        mode === "edit"
          ? [...visibleExistingMedia.map((img) => img.id), ...newUploadedIds]
          : newUploadedIds;

      if (mode === "create") {
        const res = await fetch("/api/my-posts-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ title, content: submittableContent, categories: selectedCategoryDocumentIds, tags: selectedTags.map((t) => t.documentId), imageIds }),
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(payload.error || "Tạo bài viết thất bại");
      } else {
        const res = await fetch("/api/my-posts-proxy", {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ documentId, title, content: submittableContent, categories: selectedCategoryDocumentIds, tags: selectedTags.map((t) => t.documentId), imageIds }),
        });
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) throw new Error(payload.error || "Cập nhật bài viết thất bại");
      }

      router.push("/my-posts");
      router.refresh();
    } catch (err) {
      setUploadingMedia(false);
      setProcessingMedia(false);
      setProcessingGallery(false);
      setError(err instanceof Error ? err.message : mode === "create" ? "Tạo bài viết thất bại" : "Cập nhật bài viết thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  const tabs = [
    { key: "content" as const, label: "Nội dung" },
    { key: "images" as const, label: totalMediaCount > 0 ? `Media (${totalMediaCount})` : "Media" },
  ];

  if (loadingPost) {
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">Đang tải bài viết...</p>;
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="p-5 pb-0 space-y-1">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tiêu đề</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <div className="px-5 pt-4">
        <nav className="flex gap-1 rounded-lg bg-gray-100 dark:bg-gray-700 p-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`flex-1 rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${
                activeTab === key
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "content" && (
        <div className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Danh mục</label>
            {loadingCategories ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Đang tải danh mục...</p>
            ) : (
              <MultiSelectBox
                options={categoryTreeOptions}
                value={selectedCategoryDocumentIds}
                onChange={setSelectedCategoryDocumentIds}
                placeholder="Chọn danh mục"
              />
            )}
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tags</label>
            <TagCombobox ref={tagComboboxRef} selected={selectedTags} onChange={setSelectedTags} jwt={jwt} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nội dung</label>
              <button
                type="button"
                onClick={() => setShowToolbar((v) => !v)}
                className="text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
              >
                {showToolbar ? "Ẩn định dạng" : "Hiển thị định dạng"}
              </button>
            </div>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
              <TiptapEditor value={content} onChange={setContent} showToolbar={showToolbar} onMediaPicked={handleMediaPicked} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "images" && (
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Ảnh &gt;{MAX_WIDTH}px tự động thu nhỏ. Ảnh tối đa 5MB, video tối đa 200MB.
            </p>
            <div className="relative" ref={mediaMenuRef}>
              <button
                type="button"
                onClick={() => { if (window.innerWidth >= 768) { fileInputRef.current?.click(); } else { setMediaMenuOpen((v) => !v); } }}
                disabled={processingGallery}
                className="rounded-md bg-gray-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-600 disabled:opacity-60 transition-colors"
              >
                {processingGallery ? "Đang xử lý..." : "+ Thêm media"}
              </button>
              {mediaMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-gray-700 dark:bg-gray-800">
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setMediaMenuOpen(false); fileInputRef.current?.click(); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                    Chọn từ thiết bị
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setMediaMenuOpen(false); cameraFileInputRef.current?.click(); }}
                    className="md:hidden flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                      <circle cx="12" cy="13" r="3" />
                    </svg>
                    Chụp ảnh
                  </button>
                </div>
              )}
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} />
          <input ref={cameraFileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

          {totalMediaCount === 0 ? (
            <button
              type="button"
              onClick={() => { if (window.innerWidth >= 768) { fileInputRef.current?.click(); } else { setMediaMenuOpen((v) => !v); } }}
              className="w-full rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 py-12 flex flex-col items-center gap-2 text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span className="text-sm">Chọn ảnh hoặc video để tải lên</span>
            </button>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {/* Existing media (edit mode) */}
              {visibleExistingMedia.map((item) => (
                <div
                  key={`existing-${item.id}`}
                  className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 group"
                >
                  {item.mime?.startsWith("video/") ? (
                    <video
                      src={item.url.startsWith("http") ? item.url : `${API_URL}${item.url}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.url.startsWith("http") ? item.url : `${API_URL}${item.url}`}
                      alt={item.alternativeText ?? ""}
                      className="w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setRemovedMediaIds((prev) => new Set([...prev, item.id]))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {/* New media */}
              {newMediaFiles.map((file, idx) => (
                <div
                  key={`new-${idx}`}
                  className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 group"
                >
                  {file.type.startsWith("video/") ? (
                    <video src={newMediaPreviews[idx]} className="w-full h-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={newMediaPreviews[idx]} alt={file.name} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setNewMediaFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[10px] text-white bg-black/40 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.name}
                  </span>
                </div>
              ))}
              <button
                type="button"
                onClick={() => { if (window.innerWidth >= 768) { fileInputRef.current?.click(); } else { setMediaMenuOpen((v) => !v); } }}
                disabled={processingGallery}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 transition-colors disabled:opacity-50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" x2="12" y1="5" y2="19" />
                  <line x1="5" x2="19" y1="12" y2="12" />
                </svg>
              </button>
            </div>
          )}
        </div>
      )}

      <div className="px-5 pb-5 pt-2 space-y-3">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/my-posts")}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting || uploadingMedia || processingMedia}
            className="rounded-md bg-gray-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-600 disabled:opacity-60"
          >
            {processingMedia
              ? "Đang xử lý video..."
              : uploadingMedia
                ? "Đang tải media..."
                : submitting
                  ? mode === "create" ? "Đang tạo..." : "Đang lưu..."
                  : mode === "create" ? "Tạo bài viết" : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </form>
  );
}
