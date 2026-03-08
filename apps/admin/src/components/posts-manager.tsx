"use client";

import React, { Fragment } from "react";
import Link from "next/link";
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
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deletePost,
  listAllCategories,
  listPosts,
  publishPost,
  unpublishPost,
  type CategoryItem,
  type PaginationMeta,
  type PostItem,
} from "@/lib/admin-api";

type TreeCategory = CategoryItem & { children: TreeCategory[] };

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
  categories.forEach((c) => map.set(c.id, { ...c, children: [] }));
  const roots: TreeCategory[] = [];

  for (const cat of categories) {
    const node = map.get(cat.id);
    if (node) {
      if (cat.parent?.id && map.has(cat.parent.id)) {
        map.get(cat.parent.id)!.children.push(node);
      } else {
        roots.push(node);
      }
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
  const [togglingDocumentId, setTogglingDocumentId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState("");
  const [statusInput, setStatusInput] = useState<"all" | "draft" | "published">("all");
  const [categoryInput, setCategoryInput] = useState<string>("");
  const [filters, setFilters] = useState({
    q: "",
    status: "all" as "all" | "draft" | "published",
    category: "",
  });

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

  const onDelete = async (item: PostItem) => {
    if (!confirm(`Delete post "${item.title}"?`)) {
      return;
    }
    try {
      await deletePost(item.documentId);
      toast({ title: "Post deleted", variant: "success" });
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete post");
      toast({
        title: "Failed to delete post",
        description: deleteError instanceof Error ? deleteError.message : undefined,
        variant: "error",
      });
    }
  };

  const onTogglePublished = async (item: PostItem) => {
    try {
      setTogglingDocumentId(item.documentId);
      const updated = item.publishedAt
        ? await unpublishPost(item.documentId)
        : await publishPost(item.documentId);

      setRows((prev) => {
        const next = prev.map((row) =>
          row.documentId === item.documentId
            ? { ...row, publishedAt: updated.publishedAt ?? null, updatedAt: updated.updatedAt }
            : row,
        );
        if (filters.status === "published" && !updated.publishedAt) {
          return next.filter((row) => row.documentId !== item.documentId);
        }
        if (filters.status === "draft" && updated.publishedAt) {
          return next.filter((row) => row.documentId !== item.documentId);
        }
        return next;
      });
      toast({
        title: updated.publishedAt ? "Post published" : "Post moved to draft",
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
              onChange={(event) =>
                setStatusInput(event.target.value as "all" | "draft" | "published")
              }
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
                  <button
                    type="button"
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                      item.publishedAt ? "bg-emerald-600" : "bg-muted-foreground/30"
                    }`}
                    onClick={() => onTogglePublished(item)}
                    disabled={togglingDocumentId === item.documentId}
                    title={item.publishedAt ? "Published" : "Draft"}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform ${
                        item.publishedAt ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                    <span className="sr-only">{item.publishedAt ? "Published" : "Draft"}</span>
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Author</p>
                    <p className="mt-1">{item.author?.username ?? "none"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Comments</p>
                    <p className="mt-1">{item.commentsCount ?? 0}</p>
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
                  <div className="grid shrink-0 grid-cols-3 gap-2">
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
                    <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(item)} className="px-2">
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
                  <TableCell className="text-center">{item.commentsCount ?? 0}</TableCell>
                  <TableCell className="text-right">
                    <div className="ml-auto flex w-fit gap-1.5 opacity-100 pointer-events-auto transition-opacity duration-150 md:opacity-0 md:pointer-events-none md:group-hover:opacity-100 md:group-hover:pointer-events-auto md:group-focus-within:opacity-100 md:group-focus-within:pointer-events-auto">
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
                      <IconAction
                        label="Delete post"
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
    </div>
  );
}


