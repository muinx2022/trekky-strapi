"use client";

import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconAction } from "@/components/icon-action";
import { PaginationControls } from "@/components/pagination-controls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteComment,
  listComments,
  publishComment,
  unpublishComment,
  type CommentItem,
  type PaginationMeta,
} from "@/lib/admin-api";

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

export function CommentsManager() {
  const [rows, setRows] = useState<CommentItem[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingDocumentId, setTogglingDocumentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
  const [targetType, setTargetType] = useState<"all" | CommentItem["targetType"]>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listComments(page, 10, { q, status, targetType });
      setRows(result.data);
      setPagination(result.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [page, q, status, targetType]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (item: CommentItem) => {
    if (!confirm(`Delete comment by "${item.authorName}"?`)) {
      return;
    }
    try {
      await deleteComment(item.documentId);
      toast({ title: "Comment deleted", variant: "success" });
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete comment");
      toast({
        title: "Failed to delete comment",
        description: deleteError instanceof Error ? deleteError.message : undefined,
        variant: "error",
      });
    }
  };

  const onTogglePublished = async (item: CommentItem) => {
    try {
      setTogglingDocumentId(item.documentId);
      if (item.publishedAt) {
        const updated = await unpublishComment(item.documentId);
        setRows((prev) => prev.map((row) => (
          row.documentId === item.documentId
            ? { ...row, publishedAt: updated.publishedAt ?? null, updatedAt: updated.updatedAt }
            : row
        )));
        toast({ title: "Comment moved to draft", variant: "success" });
      } else {
        const updated = await publishComment(item.documentId);
        setRows((prev) => prev.map((row) => (
          row.documentId === item.documentId
            ? { ...row, publishedAt: updated.publishedAt ?? null, updatedAt: updated.updatedAt }
            : row
        )));
        toast({ title: "Comment published", variant: "success" });
      }
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">Comments</CardTitle>
            <p className="text-sm text-muted-foreground">Manage moderation and publication state</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/comments/new" className="inline-flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              Create Comment
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_180px_180px]">
          <input
            className="h-10 rounded-md border bg-background px-3 text-sm"
            placeholder="Filter author/content..."
            value={q}
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={targetType}
            onChange={(event) => {
              setPage(1);
              setTargetType(event.target.value as "all" | CommentItem["targetType"]);
            }}
          >
            <option value="all">All type</option>
            <option value="post">Post</option>
            <option value="page">Page</option>
            <option value="product">Product</option>
            <option value="hotel">Hotel</option>
            <option value="tour">Tour</option>
            <option value="other">Other</option>
          </select>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as "all" | "draft" | "published");
            }}
          >
            <option value="all">All status</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Table className="[&_td]:align-top [&_td]:break-words [&_td]:whitespace-normal">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[70px]">ID</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[220px]">Author</TableHead>
              <TableHead className="w-[170px]">Created</TableHead>
              <TableHead className="w-[90px] text-center">Status</TableHead>
              <TableHead className="w-[1%] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((item) => (
              <TableRow key={item.documentId} className="group">
                <TableCell>{item.id}</TableCell>
                <TableCell className="capitalize">{item.targetType}</TableCell>
                <TableCell>
                  <Link
                    href={`/comments/${item.documentId}/edit`}
                    className="text-foreground transition-colors hover:text-primary hover:underline"
                  >
                    {item.targetTitle ?? item.targetDocumentId}
                  </Link>
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{item.authorName}</p>
                    <p className="text-xs text-muted-foreground">{item.authorEmail || "-"}</p>
                  </div>
                </TableCell>
                <TableCell>{formatDate(item.createdAt)}</TableCell>
                <TableCell className="text-center">
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
                </TableCell>
                <TableCell className="text-right">
                  <div className="ml-auto flex w-fit gap-1.5 opacity-100 pointer-events-auto transition-opacity duration-150 md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto">
                    <IconAction
                      label="Edit comment"
                      icon={<Pencil />}
                      href={`/comments/${item.documentId}/edit`}
                      variant="outline"
                      size="icon-xs"
                    />
                    <IconAction
                      label="Delete comment"
                      icon={<Trash2 />}
                      onClick={() => onDelete(item)}
                      variant="destructive"
                      size="icon-xs"
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                  No comments yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <PaginationControls
          page={pagination.page}
          pageCount={pagination.pageCount}
          total={pagination.total}
          onPageChange={setPage}
        />
      </CardContent>
    </Card>
  );
}


