"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = {
  value: string;
  label: string;
  depth?: number;
};

type MultiSelectBoxProps = {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
};

export function MultiSelectBox({
  options,
  value,
  onChange,
  placeholder = "Select items",
  className,
  onBlur,
}: MultiSelectBoxProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }
      const target = event.target as Node;
      if (!rootRef.current.contains(target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, []);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm",
          className,
        )}
        onClick={() => setOpen((current) => !current)}
        onBlur={onBlur}
      >
        <span className="flex flex-1 flex-wrap items-center gap-1 text-left">
          {selectedItems.length === 0 && (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          {selectedItems.map((item) => (
            <span
              key={item.value}
              className="inline-flex items-center gap-1 rounded bg-accent px-2 py-1 text-xs"
            >
              {item.label}
              <span
                role="button"
                aria-label={`Remove ${item.label}`}
                title={`Remove ${item.label}`}
                className="inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted"
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
        <ChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-md">
          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => toggleOption(option.value)}
                style={{ paddingLeft: `${8 + (option.depth ?? 0) * 16}px` }}
              >
                <span>{option.label}</span>
                {checked && <Check className="h-4 w-4" />}
              </button>
            );
          })}
          {options.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No options</p>
          )}
        </div>
      )}
    </div>
  );
}
