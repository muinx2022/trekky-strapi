"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { IconAction } from "@/components/icon-action";

type PaginationControlsProps = {
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  page,
  pageCount,
  total,
  onPageChange,
}: PaginationControlsProps) {
  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        Total: {total} | Page {page}/{pageCount}
      </p>
      <div className="flex gap-2">
        <IconAction
          label="Previous page"
          icon={<ChevronLeft />}
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <IconAction
          label="Next page"
          icon={<ChevronRight />}
          variant="outline"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}
