"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAction } from "@/components/icon-action";
import { deletePage, listPages, type PageItem, type PaginationMeta } from "@/lib/admin-api";

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

export function PagesManager() {
  const [rows, setRows] = useState<PageItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  });
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPages(page, 10, keyword);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load pages");
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (item: PageItem) => {
    if (!confirm(`Delete page "${item.title}"?`)) {
      return;
    }
    try {
      await deletePage(item.documentId);
      toast({ title: "Page deleted", variant: "success" });
      await load();
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete page";
      setError(message);
      toast({
        title: "Failed to delete page",
        description: message,
        variant: "error",
      });
    }
  };

  const onApplyFilter = () => {
    setPage(1);
    setKeyword(qInput.trim());
  };

  const onResetFilter = () => {
    setPage(1);
    setQInput("");
    setKeyword("");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">Pages</CardTitle>
            <p className="text-sm text-muted-foreground">Manage static pages</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/pages/new" className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              Create Page
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="h-10 min-w-[280px] rounded-md border bg-background px-3 text-sm"
            placeholder="Filter by title, slug, type..."
            value={qInput}
            onChange={(event) => setQInput(event.target.value)}
          />
          <Button type="button" size="sm" onClick={onApplyFilter}>
            Apply
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onResetFilter}>
            Reset
          </Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.documentId} className="group border-t">
                  <td className="px-3 py-2 font-medium">{item.title}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.slug}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.type || "-"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(item.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <div className="ml-auto flex w-fit gap-1.5 opacity-100 pointer-events-auto transition-opacity duration-150 md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto">
                      <IconAction
                        label="Edit page"
                        icon={<Pencil />}
                        variant="outline"
                        size="icon-xs"
                        href={`/pages/${item.documentId}/edit`}
                      />
                      <IconAction
                        label="Delete page"
                        icon={<Trash2 />}
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => onDelete(item)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No pages yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} / {pagination.pageCount} ({pagination.total} total)
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= pagination.pageCount}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

