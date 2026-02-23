"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, X } from "lucide-react";
import { TiptapEditor } from "@/components/tiptap-editor";
import { useAuth } from "@/components/auth-context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

type CategoryItem = {
  id: number;
  documentId: string;
  name: string;
  sortOrder?: number;
  parent?: {
    id?: number;
    documentId?: string;
  } | null;
};

type CategoryTreeOption = {
  value: string;
  label: string;
  depth: number;
};

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
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target;
      if (!(targetNode instanceof Node)) {
        return;
      }

      if (!containerRef.current?.contains(targetNode)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex flex-1 flex-wrap items-center gap-1 text-left">
          {selectedItems.length === 0 && (
            <span className="text-zinc-500 dark:text-zinc-400">{placeholder}</span>
          )}
          {selectedItems.map((item) => (
            <span
              key={item.value}
              className="inline-flex items-center gap-1 rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
            >
              {item.label}
              <span
                role="button"
                aria-label={`Remove ${item.label}`}
                title={`Remove ${item.label}`}
                className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-zinc-300 dark:hover:bg-zinc-600"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(value.filter((v) => v !== item.value));
                }}
              >
                <X className="h-3 w-3" />
              </span>
            </span>
          ))}
        </span>
        <ChevronDown className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white p-1 shadow-md dark:border-zinc-700 dark:bg-zinc-950">
          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => toggleOption(option.value)}
                style={{ paddingLeft: `${8 + option.depth * 16}px` }}
              >
                <span>{option.label}</span>
                {checked && <Check className="h-4 w-4" />}
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-zinc-500 dark:text-zinc-400">Chưa có danh mục</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function NewMyPostPage() {
  const router = useRouter();
  const { isLoggedIn, jwt, openLoginModal } = useAuth();
  const isHydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [showToolbar, setShowToolbar] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [selectedCategoryDocumentIds, setSelectedCategoryDocumentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const categoryTreeOptions = useMemo(() => {
    const byParent = new Map<string | null, CategoryItem[]>();
    for (const item of categories) {
      const parentDocumentId = item.parent?.documentId ?? null;
      const bucket = byParent.get(parentDocumentId) ?? [];
      bucket.push(item);
      byParent.set(parentDocumentId, bucket);
    }

    for (const bucket of byParent.values()) {
      bucket.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }

    const flattened: CategoryTreeOption[] = [];
    const visit = (parentDocumentId: string | null, level: number) => {
      const nodes = byParent.get(parentDocumentId) ?? [];
      for (const node of nodes) {
        flattened.push({
          value: node.documentId,
          label: node.name,
          depth: level,
        });
        visit(node.documentId, level + 1);
      }
    };

    visit(null, 0);
    return flattened;
  }, [categories]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isLoggedIn || !jwt) {
      openLoginModal();
      router.push("/");
      return;
    }

    let active = true;
    const loadCategories = async () => {
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
        const payload = (await res.json().catch(() => ({}))) as {
          data?: CategoryItem[];
        };

        if (!active) {
          return;
        }

        setCategories(payload.data ?? []);
      } finally {
        if (active) {
          setLoadingCategories(false);
        }
      }
    };

    void loadCategories();

    return () => {
      active = false;
    };
  }, [isHydrated, isLoggedIn, jwt, openLoginModal, router]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!jwt) {
      openLoginModal();
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/my-posts-proxy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          title,
          content,
          categories: selectedCategoryDocumentIds,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        data?: { documentId?: string };
        error?: string;
      };

      if (!res.ok) {
        throw new Error(payload.error || "Tạo bài viết thất bại");
      }

      router.push("/my-posts");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Tạo bài viết thất bại");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isHydrated || !isLoggedIn || !jwt) {
    return null;
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Tạo bài viết</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Viết và đăng bản nháp bài viết mới của bạn.</p>
      </header>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tiêu đề</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Danh mục (đa cấp, chọn nhiều)</label>
          {loadingCategories ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Đang tải danh mục...</p>
          ) : (
            <MultiSelectBox
              options={categoryTreeOptions}
              value={selectedCategoryDocumentIds}
              onChange={setSelectedCategoryDocumentIds}
              placeholder="Chọn danh mục"
            />
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nội dung</label>
            <button
              type="button"
              onClick={() => setShowToolbar((value) => !value)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              {showToolbar ? "Ẩn định dạng" : "Hiển thị định dạng"}
            </button>
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
            <TiptapEditor value={content} onChange={setContent} showToolbar={showToolbar} />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push("/my-posts")}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? "Đang tạo..." : "Tạo bài viết"}
          </button>
        </div>
      </form>
    </div>
  );
}
