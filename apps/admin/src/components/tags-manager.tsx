"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GitMerge, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAction } from "@/components/icon-action";
import {
  deleteTag,
  listTags,
  mergeTags,
  publishTag,
  unpublishTag,
  type PaginationMeta,
  type TagItem,
} from "@/lib/admin-api";

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

function normalizeAliases(value?: string[]) {
  return (value ?? []).map((item) => item.trim()).filter(Boolean);
}

export function TagsManager() {
  const [rows, setRows] = useState<TagItem[]>([]);
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
  const [togglingDocumentId, setTogglingDocumentId] = useState<string | null>(null);
  const [mergeSourceDocumentId, setMergeSourceDocumentId] = useState<string | null>(null);
  const [mergeTargetDocumentId, setMergeTargetDocumentId] = useState<string>("");
  const [merging, setMerging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listTags(page, 10, keyword);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load tags");
    } finally {
      setLoading(false);
    }
  }, [page, keyword]);

  useEffect(() => {
    void load();
  }, [load]);

  const sourceTag = useMemo(
    () => rows.find((item) => item.documentId === mergeSourceDocumentId) ?? null,
    [rows, mergeSourceDocumentId],
  );

  const mergeTargetOptions = useMemo(
    () => rows.filter((item) => item.documentId !== mergeSourceDocumentId),
    [rows, mergeSourceDocumentId],
  );

  const onDelete = async (item: TagItem) => {
    if (!confirm(`Delete tag "${item.name}"?`)) {
      return;
    }
    try {
      await deleteTag(item.documentId);
      toast({ title: "Tag deleted", variant: "success" });
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete tag");
      toast({
        title: "Failed to delete tag",
        description: deleteError instanceof Error ? deleteError.message : undefined,
        variant: "error",
      });
    }
  };

  const onTogglePublished = async (item: TagItem) => {
    try {
      setTogglingDocumentId(item.documentId);
      const updated = item.publishedAt ? await unpublishTag(item.documentId) : await publishTag(item.documentId);
      setRows((prev) =>
        prev.map((row) =>
          row.documentId === item.documentId
            ? { ...row, publishedAt: updated.publishedAt ?? null, updatedAt: updated.updatedAt }
            : row,
        ),
      );
      toast({
        title: updated.publishedAt ? "Tag published" : "Tag moved to draft",
        variant: "success",
      });
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : "Failed to change publish status");
      toast({
        title: "Failed to change status",
        description: toggleError instanceof Error ? toggleError.message : undefined,
        variant: "error",
      });
    } finally {
      setTogglingDocumentId(null);
    }
  };

  const onConfirmMerge = async () => {
    if (!mergeSourceDocumentId || !mergeTargetDocumentId) {
      return;
    }
    if (mergeSourceDocumentId === mergeTargetDocumentId) {
      toast({ title: "Source and target must be different", variant: "error" });
      return;
    }

    try {
      setMerging(true);
      const result = await mergeTags(mergeSourceDocumentId, mergeTargetDocumentId);
      toast({
        title: "Tags merged",
        description: `Updated ${result.mergedPostCount} post(s)`,
        variant: "success",
      });
      setMergeSourceDocumentId(null);
      setMergeTargetDocumentId("");
      await load();
    } catch (mergeError) {
      const message = mergeError instanceof Error ? mergeError.message : "Failed to merge tags";
      setError(message);
      toast({ title: "Merge failed", description: message, variant: "error" });
    } finally {
      setMerging(false);
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
            <CardTitle className="text-xl font-semibold tracking-tight">Tags</CardTitle>
            <p className="text-sm text-muted-foreground">Manage tags and merge duplicates</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/tags/new" className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              Create Tag
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="h-10 min-w-[260px] rounded-md border bg-background px-3 text-sm"
            placeholder="Filter by name or slug..."
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

        {mergeSourceDocumentId && sourceTag && (
          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-sm font-medium">
              Merge from: <span className="text-primary">{sourceTag.name}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                className="h-9 min-w-[240px] rounded-md border bg-background px-2 text-sm"
                value={mergeTargetDocumentId}
                onChange={(event) => setMergeTargetDocumentId(event.target.value)}
              >
                <option value="">Select target tag</option>
                {mergeTargetOptions.map((item) => (
                  <option key={item.documentId} value={item.documentId}>
                    {item.name} ({item.slug})
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" onClick={onConfirmMerge} disabled={merging || !mergeTargetDocumentId}>
                {merging ? "Merging..." : "Confirm merge"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setMergeSourceDocumentId(null);
                  setMergeTargetDocumentId("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Aliases</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.documentId} className="group border-t">
                  <td className="px-3 py-2 font-medium">{item.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{item.slug}</td>
                  <td className="px-3 py-2">
                    <span className="text-muted-foreground">
                      {normalizeAliases(item.aliases).join(", ") || "-"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(item.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                          item.publishedAt ? "bg-emerald-600" : "bg-muted-foreground/30"
                        }`}
                        onClick={() => onTogglePublished(item)}
                        disabled={togglingDocumentId === item.documentId}
                        title={item.publishedAt ? "Published" : "Draft"}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-background shadow transition-transform ${
                            item.publishedAt ? "translate-x-[14px]" : "translate-x-0.5"
                          }`}
                        />
                        <span className="sr-only">{item.publishedAt ? "Published" : "Draft"}</span>
                      </button>
                      <span className="text-xs text-muted-foreground">{item.publishedAt ? "Published" : "Draft"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="ml-auto flex w-fit gap-1.5 opacity-100 pointer-events-auto transition-opacity duration-150 md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto">
                      <IconAction
                        label="Merge tag"
                        icon={<GitMerge />}
                        variant="outline"
                        size="icon-xs"
                        onClick={() => {
                          setMergeSourceDocumentId(item.documentId);
                          setMergeTargetDocumentId("");
                        }}
                      />
                      <IconAction
                        label="Edit tag"
                        icon={<Pencil />}
                        variant="outline"
                        size="icon-xs"
                        href={`/tags/${item.documentId}/edit`}
                      />
                      <IconAction
                        label="Delete tag"
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
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No tags yet.
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


