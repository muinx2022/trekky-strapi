"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

export type TagOption = {
  documentId: string;
  name: string;
};

export interface TagComboboxHandle {
  commitPending: () => Promise<void>;
}

type TagComboboxProps = {
  selected: TagOption[];
  options: TagOption[];
  onChange: (tags: TagOption[]) => void;
  onCreateTag: (name: string) => Promise<TagOption | null>;
};

export const TagCombobox = forwardRef<TagComboboxHandle, TagComboboxProps>(function TagCombobox(
  { selected, options, onChange, onCreateTag },
  ref,
) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const queryRef = useRef(query);
  queryRef.current = query;

  const trimmedQuery = query.trim();
  const normalizedQuery = trimmedQuery.toLowerCase();

  const suggestions = normalizedQuery
    ? options
        .filter((tag) => tag.name.toLowerCase().includes(normalizedQuery))
        .filter((tag) => !selected.some((selectedTag) => selectedTag.documentId === tag.documentId))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 8)
    : [];

  const exactMatch = suggestions.find((tag) => tag.name.toLowerCase() === normalizedQuery);
  const alreadySelected = selected.some((tag) => tag.name.toLowerCase() === normalizedQuery);
  const showCreateOption = trimmedQuery.length > 0 && !exactMatch && !alreadySelected;
  const isDropdownVisible = open && (suggestions.length > 0 || showCreateOption);

  useImperativeHandle(ref, () => ({
    async commitPending() {
      const name = queryRef.current.trim();
      if (!name) {
        return;
      }
      await commitTag(name);
    },
  }));

  useEffect(() => {
    const handle = (event: MouseEvent | TouchEvent) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
    };
  }, []);

  const addTag = (tag: TagOption) => {
    if (selectedRef.current.some((item) => item.documentId === tag.documentId)) {
      return;
    }
    onChange([...selectedRef.current, tag]);
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const removeTag = (documentId: string) => {
    onChange(selected.filter((tag) => tag.documentId !== documentId));
  };

  const commitTag = async (rawName: string) => {
    const name = rawName.trim();
    if (!name) {
      return;
    }

    setQuery("");
    setOpen(false);

    const matched = options.find((tag) => tag.name.toLowerCase() === name.toLowerCase());
    if (matched) {
      addTag(matched);
      return;
    }

    if (selectedRef.current.some((tag) => tag.name.toLowerCase() === name.toLowerCase())) {
      return;
    }

    setPendingCount((count) => count + 1);
    try {
      const created = await onCreateTag(name);
      if (created) {
        addTag(created);
      }
    } finally {
      setPendingCount((count) => count - 1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex min-h-10 flex-wrap items-center gap-1 rounded-md border border-input bg-background px-3 py-2">
        {selected.map((tag) => (
          <span
            key={tag.documentId}
            className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-foreground"
          >
            {tag.name}
            <button
              type="button"
              aria-label={`Remove tag ${tag.name}`}
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded hover:bg-muted-foreground/20"
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
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            setOpen(nextValue.trim().length > 0);
          }}
          onFocus={() => {
            if (trimmedQuery) {
              setOpen(true);
            }
          }}
          onBlur={() => {
            void commitTag(query);
          }}
          onKeyDown={(event) => {
            if (event.key === "," || event.key === "Enter") {
              event.preventDefault();
              void commitTag(query);
            } else if (event.key === "Backspace" && query === "" && selected.length > 0) {
              onChange(selected.slice(0, -1));
            }
          }}
          placeholder={selected.length === 0 ? "Type to search or create tags..." : "Add tag..."}
          className="min-w-[140px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {pendingCount > 0 && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {isDropdownVisible && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border bg-popover shadow-md">
          {suggestions.map((tag) => (
            <button
              key={tag.documentId}
              type="button"
              className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-accent"
              onMouseDown={(event) => {
                event.preventDefault();
                addTag(tag);
              }}
            >
              {tag.name}
            </button>
          ))}
          {showCreateOption && (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-primary hover:bg-accent"
              onMouseDown={(event) => {
                event.preventDefault();
                void commitTag(trimmedQuery);
              }}
              disabled={pendingCount > 0}
            >
              <span className="font-medium">+ Create tag</span>
              <span className="truncate">&ldquo;{trimmedQuery}&rdquo;</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});
