"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, Trash2, X } from "lucide-react";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { deleteComment, getPost, listCommentsForTarget, type CommentItem, type PostItem } from "@/lib/admin-api";

type PostCommentsModalProps = {
  documentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCommentsChange?: (documentId: string, count: number) => void;
};

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function buildCommentTree(comments: CommentItem[]) {
  const byParent = new Map<string, CommentItem[]>();
  const roots: CommentItem[] = [];
  const idToDocumentId = new Map<number, string>();
  const documentIds = new Set(comments.map((comment) => comment.documentId));

  for (const comment of comments) {
    idToDocumentId.set(comment.id, comment.documentId);
  }

  for (const comment of comments) {
    const directParent = comment.parent?.documentId;
    const fallbackParent =
      typeof comment.parent?.id === "number" ? idToDocumentId.get(comment.parent.id) : undefined;
    const parentDocumentId = directParent ?? fallbackParent;

    if (!parentDocumentId || !documentIds.has(parentDocumentId)) {
      roots.push(comment);
      continue;
    }

    const bucket = byParent.get(parentDocumentId) ?? [];
    bucket.push(comment);
    byParent.set(parentDocumentId, bucket);
  }

  const sortByCreatedAt = (a: CommentItem, b: CommentItem) =>
    new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();

  roots.sort(sortByCreatedAt);
  byParent.forEach((rows) => rows.sort(sortByCreatedAt));

  return { roots, byParent };
}

export function PostCommentsModal({
  documentId,
  open,
  onOpenChange,
  onCommentsChange,
}: PostCommentsModalProps) {
  const [post, setPost] = useState<PostItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CommentItem | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !documentId) {
      return;
    }

    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [postItem, commentResult] = await Promise.all([
          getPost(documentId),
          listCommentsForTarget("post", documentId),
        ]);
        if (!active) return;
        setPost(postItem);
        setComments(commentResult.data);
        onCommentsChange?.(documentId, commentResult.data.length);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load post comments");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [documentId, onCommentsChange, open]);

  const { roots, byParent } = useMemo(() => buildCommentTree(comments), [comments]);

  const handleDelete = async () => {
    if (!deleteTarget || !documentId) {
      return;
    }

    setDeletingDocumentId(deleteTarget.documentId);
    try {
      await deleteComment(deleteTarget.documentId);
      const refreshed = await listCommentsForTarget("post", documentId);
      setComments(refreshed.data);
      onCommentsChange?.(documentId, refreshed.data.length);
      setDeleteTarget(null);
      toast({ title: "Comment branch deleted", variant: "success" });
    } catch (deleteError) {
      toast({
        title: "Failed to delete comment branch",
        description: deleteError instanceof Error ? deleteError.message : undefined,
        variant: "error",
      });
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const renderCommentNode = (comment: CommentItem, depth = 0): React.ReactNode => {
    const children = byParent.get(comment.documentId) ?? [];
    return (
      <div key={comment.documentId} className="space-y-2">
        <div
          className="rounded-xl border bg-background/80 p-3 shadow-xs"
          style={depth > 0 ? { marginLeft: `${Math.min(depth, 6) * 20}px` } : undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{comment.authorName}</p>
                <span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span>
              </div>
              {comment.authorEmail && (
                <p className="text-xs text-muted-foreground">{comment.authorEmail}</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={() => setDeleteTarget(comment)}
              disabled={deletingDocumentId === comment.documentId}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
          <div className="mt-3 rounded-lg bg-muted/30 p-3 text-sm text-foreground/90">
            <div dangerouslySetInnerHTML={{ __html: comment.content ?? "" }} />
          </div>
        </div>

        {children.length > 0 && <div className="space-y-2">{children.map((child) => renderCommentNode(child, depth + 1))}</div>}
      </div>
    );
  };

  if (!open || !documentId) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="flex h-[80vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">Post comments</h2>
              <p className="text-sm text-muted-foreground">Review post details and delete comment branches.</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
            <Card className="min-h-0 overflow-hidden py-0">
              <CardContent className="flex h-full min-h-0 flex-col overflow-hidden p-5">
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading post...
                  </div>
                )}
                {error && <p className="text-sm text-destructive">{error}</p>}
                {!loading && !error && post && (
                  <div className="flex min-h-0 flex-1 flex-col gap-4">
                    <div className="shrink-0">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Post</p>
                      <h3 className="mt-1 text-xl font-semibold">{post.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{post.slug}</p>
                    </div>
                    <div className="grid shrink-0 gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Author</p>
                        <p className="mt-1">{post.author?.username ?? "none"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Comments</p>
                        <p className="mt-1">{comments.length}</p>
                      </div>
                    </div>
                    {post.excerpt && (
                      <div className="shrink-0">
                        <p className="text-xs text-muted-foreground">Excerpt</p>
                        <p className="mt-1 text-sm">{post.excerpt}</p>
                      </div>
                    )}
                    <div className="flex min-h-0 flex-1 flex-col">
                      <p className="mb-2 shrink-0 text-xs text-muted-foreground">Content preview</p>
                      <div
                        className="min-h-0 flex-1 overflow-y-auto rounded-lg border bg-muted/20 p-3 text-sm"
                        dangerouslySetInnerHTML={{ __html: post.content ?? "" }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="min-h-0 overflow-hidden py-0">
              <CardContent className="flex h-full min-h-0 flex-col overflow-hidden p-5">
                <div className="mb-4 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">Comments ({comments.length})</p>
                </div>
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading comments...
                  </div>
                )}
                {!loading && comments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No comments for this post yet.</p>
                )}
                <div className="min-h-0 flex-1 overflow-auto pr-1">
                  <div className="min-w-max space-y-3">{roots.map((comment) => renderCommentNode(comment))}</div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-2xl">
              <h3 className="text-base font-semibold">Delete comment branch?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                This will delete the selected comment and all of its replies.
              </p>
              <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-sm">
                <p className="font-medium">{deleteTarget.authorName}</p>
                <div className="mt-1 line-clamp-3" dangerouslySetInnerHTML={{ __html: deleteTarget.content ?? "" }} />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={!!deletingDocumentId}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={!!deletingDocumentId}>
                  {deletingDocumentId ? "Deleting..." : "Delete branch"}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
