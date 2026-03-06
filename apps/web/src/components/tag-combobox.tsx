"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

export type TagOption = { documentId: string; name: string };
export interface TagComboboxHandle {
  commitPending: () => Promise<void>;
}

type StrapiTagRow = { documentId?: string; name?: string };

export const TagCombobox = forwardRef<TagComboboxHandle, {
  selected: TagOption[];
  onChange: (tags: TagOption[]) => void;
  jwt: string | null;
}>(function TagCombobox({ selected, onChange, jwt }, ref) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<TagOption[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const queryRef = useRef(query);
  queryRef.current = query;
  const suggestionsRef = useRef(suggestions);
  suggestionsRef.current = suggestions;

  useImperativeHandle(ref, () => ({
    async commitPending() {
      const name = queryRef.current.trim();
      if (!name) return;
      setQuery("");
      setSuggestions([]);
      setOpen(false);
      const exactMatch = suggestionsRef.current.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (exactMatch && !selectedRef.current.some((s) => s.documentId === exactMatch.documentId)) {
        addTag(exactMatch);
        return;
      }
      if (!selectedRef.current.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
        await createTagAndAdd(name);
      }
    },
  }));

  // Close on outside click
  useEffect(() => {
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
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = query.trim();
    if (!trimmed) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          "filters[name][$containsi]": trimmed,
          "fields[0]": "documentId",
          "fields[1]": "name",
          "pagination[pageSize]": "8",
          sort: "name:asc",
        });
        const res = await fetch(`${API_URL}/api/tags?${params.toString()}`, { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { data?: StrapiTagRow[] };
        setSuggestions(
          (payload.data ?? [])
            .filter((t): t is { documentId: string; name: string } => !!t.documentId && !!t.name)
            .filter((t) => !selected.some((s) => s.documentId === t.documentId)),
        );
        setOpen(true);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, selected]);

  const addTag = (tag: TagOption) => {
    if (selectedRef.current.some((t) => t.documentId === tag.documentId)) return;
    onChange([...selectedRef.current, tag]);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (documentId: string) => {
    onChange(selected.filter((t) => t.documentId !== documentId));
  };

  const createTagAndAdd = async (name: string) => {
    if (!jwt) return;
    setPendingCount((c) => c + 1);
    try {
      const res = await fetch("/api/tags-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return;
      const payload = (await res.json()) as { data?: TagOption };
      if (payload.data?.documentId) {
        addTag({ documentId: payload.data.documentId, name: payload.data.name });
      }
    } finally {
      setPendingCount((c) => c - 1);
    }
  };

  const handleCommitCurrent = () => {
    const name = query.trim();
    if (!name) return;
    // Clear input immediately so user can type next tag without waiting for async
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    const exactMatch = suggestions.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (exactMatch && !selectedRef.current.some((s) => s.documentId === exactMatch.documentId)) {
      addTag(exactMatch);
      return;
    }
    if (!selectedRef.current.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      void createTagAndAdd(name);
    }
  };

  const trimmedQuery = query.trim();
  const exactMatch = suggestions.some((s) => s.name.toLowerCase() === trimmedQuery.toLowerCase());
  const alreadySelected = selected.some((s) => s.name.toLowerCase() === trimmedQuery.toLowerCase());
  const showCreateOption = trimmedQuery.length > 0 && !exactMatch && !alreadySelected;

  const isDropdownVisible = open && (suggestions.length > 0 || showCreateOption);

  return (
    <div ref={containerRef} className="relative">
      <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
        {selected.map((tag) => (
          <span
            key={tag.documentId}
            className="inline-flex items-center gap-1 rounded bg-zinc-200 px-2 py-0.5 text-xs text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100"
          >
            {tag.name}
            <button
              type="button"
              aria-label={`Xóa tag ${tag.name}`}
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded hover:bg-zinc-300 dark:hover:bg-zinc-600"
              onClick={() => removeTag(tag.documentId)}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => trimmedQuery && setOpen(true)}
          onBlur={() => handleCommitCurrent()}
          onKeyDown={(e) => {
            if (e.key === "," || e.key === "Enter") {
              e.preventDefault();
              handleCommitCurrent();
            } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
              onChange(selected.slice(0, -1));
            }
          }}
          placeholder={selected.length === 0 ? "Gõ để tìm hoặc tạo tag..." : "Thêm tag..."}
          className="min-w-[120px] flex-1 bg-transparent text-sm text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        {(searching || pendingCount > 0) && <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />}
      </div>

      {isDropdownVisible && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-zinc-200 bg-white shadow-md dark:border-zinc-700 dark:bg-zinc-950">
          {suggestions.map((tag) => (
            <button
              key={tag.documentId}
              type="button"
              className="flex w-full items-center px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              onClick={() => addTag(tag)}
            >
              {tag.name}
            </button>
          ))}
          {showCreateOption && (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-blue-600 hover:bg-zinc-100 dark:text-blue-400 dark:hover:bg-zinc-800"
              onClick={() => void createTagAndAdd(trimmedQuery)}
              disabled={pendingCount > 0}
            >
              <span className="font-medium">+ Tạo tag</span>
              <span className="truncate">&ldquo;{trimmedQuery}&rdquo;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});

