"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { MessageSquare, Pencil, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getPost, listCommentsForTarget, type CommentItem, type PostItem } from "@/lib/admin-api";

type PostViewProps = {
  documentId: string;
};
const API_URL = "";

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

function resolveAssetUrl(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url}`;
}

function buildCommentTree(comments: CommentItem[]) {
  const byParent: Record<string, CommentItem[]> = {};
  const roots: CommentItem[] = [];
  const idToDocumentId = new Map<number, string>();
  const idSet = new Set(comments.map((comment) => comment.documentId));

  for (const comment of comments) {
    idToDocumentId.set(comment.id, comment.documentId);
  }

  for (const comment of comments) {
    const rawParent = comment.parent;
    const parentId =
      rawParent?.documentId ??
      (typeof rawParent?.id === "number" ? idToDocumentId.get(rawParent.id) : undefined);
    if (!parentId || !idSet.has(parentId)) {
      roots.push(comment);
      continue;
    }
    if (!byParent[parentId]) {
      byParent[parentId] = [];
    }
    byParent[parentId].push(comment);
  }

  const sortByCreated = (a: CommentItem, b: CommentItem) =>
    new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();

  roots.sort(sortByCreated);
  for (const parentId of Object.keys(byParent)) {
    byParent[parentId].sort(sortByCreated);
  }

  return { roots, byParent };
}

export function PostView({ documentId }: PostViewProps) {
  const [post, setPost] = useState<PostItem | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const postItem = await getPost(documentId);
        const commentResult = await listCommentsForTarget("post", documentId);
        setPost(postItem);
        setComments(commentResult.data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load post details");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [documentId]);

  const { roots, byParent } = buildCommentTree(comments);

  const renderCommentNode = (comment: CommentItem, depth = 0) => {
    const children = byParent[comment.documentId] ?? [];
    const indentPx = depth * 24;

    return (
      <div key={comment.documentId} className="space-y-2">
        <div className="rounded-md border p-3" style={indentPx > 0 ? { marginLeft: `${indentPx}px` } : undefined}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">{comment.authorName}</p>
            <p className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</p>
          </div>
          <div
            className="richtext-content mt-2 text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: comment.content ?? "" }}
          />
        </div>
        {children.length > 0 && (
          <div className="space-y-2">
            {children.map((child) => renderCommentNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Post View</CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/posts">Back to list</Link>
              </Button>
              <Button asChild>
                <Link href={`/posts/${documentId}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && post && (
            <div className="space-y-3">
              <div>
                <h1 className="text-2xl font-semibold">{post.title}</h1>
                <p className="text-sm text-muted-foreground">{post.slug}</p>
                <p className="text-xs text-muted-foreground">
                  Author: {post.author?.username ?? "none"}
                </p>
                {post.aiSource?.provider && (
                  <p className="text-xs text-muted-foreground">
                    AI: {post.aiSource.provider} / {post.aiSource.model ?? "unknown"}
                  </p>
                )}
              </div>
              {post.excerpt && <p className="text-sm text-muted-foreground">{post.excerpt}</p>}
              {(post.images ?? []).length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Gallery ({post.images?.length ?? 0})</p>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {(post.images ?? []).map((image) => (
                      <a
                        key={image.id}
                        href={resolveAssetUrl(image.url)}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-md border"
                      >
                        {image.mime?.startsWith("video/") ? (
                          <video
                            src={resolveAssetUrl(image.url)}
                            className="aspect-square h-full w-full object-cover"
                            controls
                          />
                        ) : (
                          <Image
                            src={resolveAssetUrl(image.url)}
                            alt={image.alternativeText || image.name || "Post image"}
                            width={image.width || 400}
                            height={image.height || 400}
                            unoptimized
                            className="aspect-square h-full w-full object-cover"
                          />
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-md border bg-background p-4">
                <div className="richtext-content" dangerouslySetInnerHTML={{ __html: post.content ?? "" }} />
              </div>
              {(post.categories ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(post.categories ?? []).map((category) => (
                    <span
                      key={category.documentId}
                      className="inline-flex items-center rounded-full border px-2 py-1 text-xs"
                    >
                      <Tag className="mr-1 h-3 w-3" />
                      {category.name}
                    </span>
                  ))}
                </div>
              )}
              {(post.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(post.tags ?? []).map((tag) => (
                    <span
                      key={tag.documentId}
                      className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700"
                    >
                      #{tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Related Comments ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {roots.map((comment) => renderCommentNode(comment))}
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground">No related comments.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
