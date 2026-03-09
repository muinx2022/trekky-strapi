"use client";

import React, { Fragment } from "react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
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
  deletePost,
  listAllCategories,
  listPosts,
  unpublishPost,
  type CategoryItem,
  type PaginationMeta,
  type PostItem,
} from "@/lib/admin-api";
import { PostCommentsModal } from "@/components/post-comments-modal";

type TreeCategory = CategoryItem & { children: TreeCategory[] };

type PendingPostAction =
  | { type: "delete"; post: PostItem }
  | { type: "unpublish"; post: PostItem }
  | null;

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

function buildCategoryTree(categories: CategoryItem[]) {
  const map = new Map<number, TreeCategory>();
  categories.forEach((category) => map.set(category.id, { ...category, children: [] }));
  const roots: TreeCategory[] = [];

  for (const category of categories) {
    const node = map.get(category.id);
    if (!node) continue;

    if (category.parent?.id && map.has(category.parent.id)) {
      map.get(category.parent.id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function CategoryOptions({
  nodes,
  level = 0,
}: {
  nodes: TreeCategory[];
  level?: number;
}) {
  return (
    <>
      {nodes.map((node) => (
        <Fragment key={node.id}>
          <option value={node.documentId}>
            {"\u00A0".repeat(level * 4)}
            {node.name}
          </option>
          {node.children.length > 0 && <CategoryOptions nodes={node.children} level={level + 1} />}
        </Fragment>
      ))}
    </>
  );
}

function PostStatusBadge({ publishedAt }: { publishedAt?: string | null }) {
  const published = !!publishedAt;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        published
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
      }`}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

function ConfirmPostActionModal({
  pendingAction,
  loading,
  onCancel,
  onConfirm,
}: {
  pendingAction: PendingPostAction;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!pendingAction) {
    return null;
  }

  const isDelete = pendingAction.type === "delete";
  const title = isDelete ? "Delete post" : "Unpublish post";
  const description = isDelete
    ? `Delete "${pendingAction.post.title}"? This action cannot be undone.`
    : `Move "${pendingAction.post.title}" back to draft?`;
  const confirmLabel = isDelete ? "Delete" : "Unpublish";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={isDelete ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PostsManager() {
  const [rows, setRows] = useState<PostItem[]>([]);
  const [categories, setCategories] = useState<TreeCategory[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    pageCount: 1,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionDocumentId, setActionDocumentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState("");
  const [statusInput, setStatusInput] = useState<"all" | "draft" | "published">("all");
  const [categoryInput, setCategoryInput] = useState<string>("");
  const [filters, setFilters] = useState({
    q: "",
    status: "all" as "all" | "draft" | "published",
    category: "",
  });
  const [commentsModalPostId, setCommentsModalPostId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingPostAction>(null);

  useEffect(() => {
    listAllCategories().then((cats) => {
      setCategories(buildCategoryTree(cats));
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listPosts(page, 10, filters);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyUpdatedPost = useCallback((documentId: string, publishedAt: string | null, updatedAt?: string) => {
    setRows((prev) => {
      const next = prev.map((row) =>
        row.documentId === documentId
          ? { ...row, publishedAt, updatedAt: updatedAt ?? row.updatedAt }
          : row,
      );
      if (filters.status === "published" && !publishedAt) {
        return next.filter((row) => row.documentId !== documentId);
      }
      if (filters.status === "draft" && publishedAt) {
        return next.filter((row) => row.documentId !== documentId);
      }
      return next;
    });
  }, [filters.status]);

  const onConfirmAction = async () => {
    if (!pendingAction) {
      return;
    }

    const { post, type } = pendingAction;
    try {
      setActionDocumentId(post.documentId);

      if (type === "delete") {
        await deletePost(post.documentId);
        toast({ title: "Post deleted", variant: "success" });
        await load();
      } else {
        const updated = await unpublishPost(post.documentId);
        applyUpdatedPost(post.documentId, updated.publishedAt ?? null, updated.updatedAt);
        toast({ title: "Post moved to draft", variant: "success" });
      }

      setPendingAction(null);
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "Action failed";
      setError(message);
      toast({
        title: type === "delete" ? "Failed to delete post" : "Failed to unpublish post",
        description: message,
        variant: "error",
      });
    } finally {
      setActionDocumentId(null);
    }
  };

  const onApplyFilters = () => {
    setPage(1);
    setFilters({
      q: qInput,
      status: statusInput,
      category: categoryInput,
    });
  };

  const onResetFilters = () => {
    setQInput("");
    setStatusInput("all");
    setCategoryInput("");
    setPage(1);
    setFilters({
      q: "",
      status: "all",
      category: "",
    });
  };

  const updatePostCommentCount = useCallback((documentId: string, count: number) => {
    setRows((prev) =>
      prev.map((row) =>
        row.documentId === documentId
          ? { ...row, commentsCount: count }
          : row,
      ),
    );
  }, []);

  const confirmLoading = useMemo(() => {
    if (!pendingAction) return false;
    return actionDocumentId === pendingAction.post.documentId;
  }, [actionDocumentId, pendingAction]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl font-semibold tracking-tight">Posts</CardTitle>
              <p className="text-sm text-muted-foreground">Manage posts and publication status</p>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
              <Link href="/posts/new" className="inline-flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                Create Post
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_200px_200px]">
            <input
              className="h-10 rounded-md border bg-background px-3 text-sm"
              placeholder="Filter by title, slug, excerpt..."
              value={qInput}
              onChange={(event) => setQInput(event.target.value)}
            />
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={categoryInput}
              onChange={(event) => setCategoryInput(event.target.value)}
            >
              <option value="">All categories</option>
              <CategoryOptions nodes={categories} />
            </select>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={statusInput}
              onChange={(event) => setStatusInput(event.target.value as "all" | "draft" | "published")}
            >
              <option value="all">All status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </div>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" size="sm" onClick={onApplyFilters} className="w-full sm:w-auto">
              Apply
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onResetFilters} className="w-full sm:w-auto">
              Reset
            </Button>
          </div>
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-3 md:hidden">
            {rows.map((item) => (
              <div key={item.documentId} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Post #{item.id}</p>
                    <Link
                      href={`/posts/${item.documentId}/edit`}
                      className="mt-1 line-clamp-2 font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{item.slug}</p>
                  </div>
                  <PostStatusBadge publishedAt={item.publishedAt} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Author</p>
                    <p className="mt-1">{item.author?.username ?? "none"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Comments</p>
                    <button
                      type="button"
                      className="mt-1 cursor-pointer text-left font-medium text-primary hover:underline"
                      onClick={() => setCommentsModalPostId(item.documentId)}
                    >
                      {item.commentsCount ?? 0}
                    </button>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Category</p>
                    <p className="mt-1 line-clamp-2">{(item.categories ?? []).map((cat) => cat.name).join(", ") || "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="mt-1">{formatDate(item.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Updated</p>
                    <p className="mt-1">{formatDate(item.updatedAt)}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium">{item.publishedAt ? "Published" : "Draft"}</p>
                  <div className={`grid shrink-0 gap-2 ${item.publishedAt ? "grid-cols-4" : "grid-cols-3"}`}>
                    <Button asChild variant="outline" size="sm" className="px-2">
                      <Link href={`/posts/${item.documentId}/view`} className="inline-flex items-center gap-1.5">
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">View</span>
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="px-2">
                      <Link href={`/posts/${item.documentId}/edit`} className="inline-flex items-center gap-1.5">
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                    {item.publishedAt && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="px-2"
                        onClick={() => setPendingAction({ type: "unpublish", post: item })}
                        disabled={actionDocumentId === item.documentId}
                      >
                        <EyeOff className="h-4 w-4" />
                        <span className="sr-only">Unpublish</span>
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setPendingAction({ type: "delete", post: item })}
                      className="px-2"
                      disabled={actionDocumentId === item.documentId}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {rows.length === 0 && !loading && (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                No posts yet.
              </div>
            )}
          </div>

          <div className="hidden md:block">
            <Table className="[&_td]:align-top [&_td]:break-words [&_td]:whitespace-normal">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[56px]">ID</TableHead>
                  <TableHead className="w-[28%]">Title</TableHead>
                  <TableHead className="w-[20%]">Category</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-[120px] text-center">Status</TableHead>
                  <TableHead className="w-[52px] text-center">Cmt</TableHead>
                  <TableHead className="w-[1%] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={item.documentId} className="group">
                    <TableCell>{item.id}</TableCell>
                    <TableCell>
                      <div>
                        <Link
                          href={`/posts/${item.documentId}/edit`}
                          className="font-medium text-foreground transition-colors hover:text-primary hover:underline"
                        >
                          {item.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">{item.slug}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <span className="line-clamp-2">
                        {(item.categories ?? []).map((cat) => cat.name).join(", ") || "-"}
                      </span>
                    </TableCell>
                    <TableCell>{item.author?.username ?? "none"}</TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                    <TableCell>{formatDate(item.updatedAt)}</TableCell>
                    <TableCell className="text-center">
                      <PostStatusBadge publishedAt={item.publishedAt} />
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        className="cursor-pointer font-medium text-primary hover:underline"
                        onClick={() => setCommentsModalPostId(item.documentId)}
                      >
                        {item.commentsCount ?? 0}
                      </button>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="ml-auto flex w-fit gap-1.5 opacity-100 transition-opacity duration-150 md:pointer-events-none md:opacity-0 md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100">
                        <IconAction
                          label="View post"
                          icon={<Eye />}
                          href={`/posts/${item.documentId}/view`}
                          variant="outline"
                          size="icon-xs"
                        />
                        <IconAction
                          label="Edit post"
                          icon={<Pencil />}
                          href={`/posts/${item.documentId}/edit`}
                          variant="outline"
                          size="icon-xs"
                        />
                        {item.publishedAt && (
                          <IconAction
                            label="Unpublish post"
                            icon={<EyeOff />}
                            onClick={() => setPendingAction({ type: "unpublish", post: item })}
                            variant="outline"
                            size="icon-xs"
                            disabled={actionDocumentId === item.documentId}
                          />
                        )}
                        <IconAction
                          label="Delete post"
                          icon={<Trash2 />}
                          onClick={() => setPendingAction({ type: "delete", post: item })}
                          variant="destructive"
                          size="icon-xs"
                          disabled={actionDocumentId === item.documentId}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-sm text-muted-foreground">
                      No posts yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <PaginationControls
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            onPageChange={setPage}
          />
        </CardContent>
      </Card>

      <PostCommentsModal
        documentId={commentsModalPostId}
        open={!!commentsModalPostId}
        onOpenChange={(open) => {
          if (!open) {
            setCommentsModalPostId(null);
          }
        }}
        onCommentsChange={updatePostCommentCount}
      />

      <ConfirmPostActionModal
        pendingAction={pendingAction}
        loading={confirmLoading}
        onCancel={() => {
          if (!confirmLoading) {
            setPendingAction(null);
          }
        }}
        onConfirm={() => {
          void onConfirmAction();
        }}
      />
    </div>
  );
}
