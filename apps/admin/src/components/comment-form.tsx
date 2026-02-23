"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  createComment,
  getPost,
  getComment,
  listCommentsForTarget,
  listPosts,
  listUsers,
  updateComment,
  type CommentItem,
  type PostItem,
  type UserItem,
} from "@/lib/admin-api";
import { resolveRichTextMediaBeforeSave } from "@/lib/richtext-media";

type CommentFormProps = {
  mode: "create" | "edit";
  documentId?: string;
};

type CommentFormData = {
  authorName: string;
  authorEmail: string;
  content: string;
  targetType: CommentItem["targetType"];
  targetDocumentId: string;
  parentDocumentId: string;
};

const emptyForm: CommentFormData = {
  authorName: "",
  authorEmail: "",
  content: "<p></p>",
  targetType: "post",
  targetDocumentId: "",
  parentDocumentId: "",
};
type CommentField = "authorName" | "authorEmail" | "targetType" | "targetDocumentId";
type CommentErrors = Partial<Record<CommentField, string>>;

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function CommentForm({ mode, documentId }: CommentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CommentFormData>(emptyForm);
  const [errors, setErrors] = useState<CommentErrors>({});
  const [postSearch, setPostSearch] = useState("");
  const [postOptions, setPostOptions] = useState<PostItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [replyOptions, setReplyOptions] = useState<CommentItem[]>([]);
  const [postPickerOpen, setPostPickerOpen] = useState(false);
  const [selectedPostTitle, setSelectedPostTitle] = useState("");
  const [authorPickerOpen, setAuthorPickerOpen] = useState(false);
  const [authorSearch, setAuthorSearch] = useState("");
  const [authorOptions, setAuthorOptions] = useState<UserItem[]>([]);
  const [loadingAuthors, setLoadingAuthors] = useState(false);

  useEffect(() => {
    if (mode !== "edit" || !documentId) {
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const comment = await getComment(documentId);
        setForm({
          authorName: comment.authorName ?? "",
          authorEmail: comment.authorEmail ?? "",
          content: comment.content ?? "<p></p>",
          targetType: comment.targetType ?? "post",
          targetDocumentId: comment.targetDocumentId ?? "",
          parentDocumentId: comment.parent?.documentId ?? "",
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load comment");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [mode, documentId]);

  useEffect(() => {
    if (form.targetType !== "post") {
      setPostOptions([]);
      setSelectedPostTitle("");
      return;
    }

    const loadPosts = async () => {
      setLoadingPosts(true);
      try {
        const result = await listPosts(1, 50, {
          q: postSearch,
          status: "all",
        });
        setPostOptions(result.data);
      } finally {
        setLoadingPosts(false);
      }
    };

    void loadPosts();
  }, [form.targetType, postSearch]);

  useEffect(() => {
    if (form.targetType !== "post" || !form.targetDocumentId) {
      setSelectedPostTitle("");
      return;
    }

    const byLoaded = postOptions.find((item) => item.documentId === form.targetDocumentId);
    if (byLoaded) {
      setSelectedPostTitle(byLoaded.title);
      return;
    }

    const loadSelectedPost = async () => {
      try {
        const post = await getPost(form.targetDocumentId);
        setSelectedPostTitle(post.title ?? form.targetDocumentId);
      } catch {
        setSelectedPostTitle(form.targetDocumentId);
      }
    };

    void loadSelectedPost();
  }, [form.targetType, form.targetDocumentId, postOptions]);

  useEffect(() => {
    if (!form.targetType || !form.targetDocumentId) {
      setReplyOptions([]);
      return;
    }

    const loadReplies = async () => {
      try {
        const result = await listCommentsForTarget(form.targetType, form.targetDocumentId);
        setReplyOptions(
          result.data.filter((item) => (mode === "edit" ? item.documentId !== documentId : true)),
        );
      } catch {
        setReplyOptions([]);
      }
    };

    void loadReplies();
  }, [form.targetType, form.targetDocumentId, mode, documentId]);

  useEffect(() => {
    if (!authorPickerOpen) {
      return;
    }

    const loadUsers = async () => {
      setLoadingAuthors(true);
      try {
        const result = await listUsers(1, 50, authorSearch);
        setAuthorOptions(result.data);
      } finally {
        setLoadingAuthors(false);
      }
    };

    void loadUsers();
  }, [authorPickerOpen, authorSearch]);

  const validateForm = () => {
    const nextErrors: CommentErrors = {};
    if (!form.authorName.trim()) {
      nextErrors.authorName = "Author name is required";
    }
    if (form.authorEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.authorEmail.trim())) {
      nextErrors.authorEmail = "Invalid email format";
    }
    if (!form.targetType.trim()) {
      nextErrors.targetType = "Target type is required";
    }
    if (!form.targetDocumentId.trim()) {
      nextErrors.targetDocumentId = "Target documentId is required";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateForm()) {
      toast({ title: "Please check input data", variant: "error" });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const content = await resolveRichTextMediaBeforeSave(form.content);
      const payload = {
        ...form,
        content,
        parent: form.parentDocumentId || null,
      };
      if (mode === "edit" && documentId) {
        await updateComment(documentId, payload);
      } else {
        await createComment(payload);
      }
      toast({
        title: mode === "edit" ? "Comment updated" : "Comment created",
        variant: "success",
      });
      router.push("/comments");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save comment");
      toast({
        title: "Failed to save comment",
        description: submitError instanceof Error ? submitError.message : undefined,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{mode === "edit" ? "Edit Comment" : "Create Comment"}</CardTitle>
          <Button variant="outline" asChild>
            <Link href="/comments">Back to list</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {!loading && (
          <form className="space-y-3" onSubmit={onSubmit} noValidate>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="No author selected"
                  value={
                    form.authorName
                      ? `${form.authorName}${form.authorEmail ? ` (${form.authorEmail})` : ""}`
                      : ""
                  }
                  className={
                    errors.authorName || errors.authorEmail
                      ? "border-destructive focus-visible:ring-destructive/20"
                      : ""
                  }
                  readOnly
                  onBlur={() => {
                    if (!form.authorName.trim()) {
                      setErrors((prev) => ({ ...prev, authorName: "Author name is required" }));
                    } else {
                      setErrors((prev) => ({ ...prev, authorName: undefined }));
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => setAuthorPickerOpen(true)}>
                  Select Author
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setForm((p) => ({ ...p, authorName: "", authorEmail: "" }));
                    setErrors((prev) => ({ ...prev, authorName: "Author name is required" }));
                  }}
                  disabled={!form.authorName}
                >
                  Clear
                </Button>
              </div>
              <input type="hidden" value={form.authorName} readOnly />
            </div>
            <select
              className={`h-10 w-full rounded-md border bg-background px-3 text-sm ${
                errors.targetType ? "border-destructive focus-visible:ring-destructive/20" : ""
              }`}
              value={form.targetType}
              onChange={(event) => {
                const targetType = event.target.value as CommentItem["targetType"];
                setForm((p) => ({
                  ...p,
                  targetType,
                  targetDocumentId: "",
                  parentDocumentId: "",
                }));
                setPostSearch("");
                setPostPickerOpen(false);
              }}
              onBlur={() => {
                if (!form.targetType.trim()) {
                  setErrors((prev) => ({ ...prev, targetType: "Target type is required" }));
                } else {
                  setErrors((prev) => ({ ...prev, targetType: undefined }));
                }
              }}
            >
              <option value="post">Post</option>
              <option value="page">Page</option>
              <option value="product">Product</option>
              <option value="hotel">Hotel</option>
              <option value="tour">Tour</option>
              <option value="other">Other</option>
            </select>
            {form.targetType === "post" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={selectedPostTitle}
                    placeholder="No post selected"
                    readOnly
                    className={
                      errors.targetDocumentId ? "border-destructive focus-visible:ring-destructive/20" : ""
                    }
                    onBlur={() => {
                      if (!form.targetDocumentId.trim()) {
                        setErrors((prev) => ({
                          ...prev,
                          targetDocumentId: "Target documentId is required",
                        }));
                      } else {
                        setErrors((prev) => ({ ...prev, targetDocumentId: undefined }));
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => setPostPickerOpen(true)}>
                    Select Post
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setForm((p) => ({ ...p, targetDocumentId: "", parentDocumentId: "" }));
                      setSelectedPostTitle("");
                    }}
                    disabled={!form.targetDocumentId}
                  >
                    Clear
                  </Button>
                </div>
                <input type="hidden" value={form.targetDocumentId} readOnly />
              </div>
            ) : (
              <Input
                placeholder="Target documentId"
                value={form.targetDocumentId}
                className={errors.targetDocumentId ? "border-destructive focus-visible:ring-destructive/20" : ""}
                onChange={(event) => setForm((p) => ({ ...p, targetDocumentId: event.target.value }))}
                onBlur={() => {
                  if (!form.targetDocumentId.trim()) {
                    setErrors((prev) => ({
                      ...prev,
                      targetDocumentId: "Target documentId is required",
                    }));
                  } else {
                    setErrors((prev) => ({ ...prev, targetDocumentId: undefined }));
                  }
                }}
                required
              />
            )}
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.parentDocumentId}
              onChange={(event) =>
                setForm((p) => ({ ...p, parentDocumentId: event.target.value }))
              }
              disabled={!form.targetDocumentId}
            >
              <option value="">No parent (root comment)</option>
              {replyOptions.map((item) => (
                <option key={item.documentId} value={item.documentId}>
                  {item.authorName}: {stripHtml(item.content).slice(0, 80)}
                </option>
              ))}
            </select>
            <RichTextEditor
              value={form.content}
              onChange={(content) => setForm((p) => ({ ...p, content }))}
              placeholder="Write comment content..."
            />
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : mode === "edit" ? "Update" : "Create"}
            </Button>
          </form>
        )}
      </CardContent>
      {postPickerOpen && form.targetType === "post" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="font-medium">Select Post</p>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPostPickerOpen(false)}>
                Close
              </Button>
            </div>
            <div className="space-y-3 p-4">
              <Input
                placeholder="Search post by title or slug..."
                value={postSearch}
                onChange={(event) => setPostSearch(event.target.value)}
              />
              <div className="max-h-80 overflow-y-auto rounded-md border">
                {loadingPosts && (
                  <p className="p-3 text-sm text-muted-foreground">Loading posts...</p>
                )}
                {!loadingPosts &&
                  postOptions.map((post) => (
                    <button
                      key={post.documentId}
                      type="button"
                      className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                      onClick={() => {
                        setForm((p) => ({
                          ...p,
                          targetDocumentId: post.documentId,
                          parentDocumentId: "",
                        }));
                        setSelectedPostTitle(post.title);
                        setErrors((prev) => ({ ...prev, targetDocumentId: undefined }));
                        setPostPickerOpen(false);
                      }}
                    >
                      <span className="font-medium">{post.title}</span>
                      <span className="text-xs text-muted-foreground">{post.slug}</span>
                    </button>
                  ))}
                {!loadingPosts && postOptions.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">No posts found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {authorPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-lg border bg-background shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="font-medium">Select Author</p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAuthorPickerOpen(false)}
              >
                Close
              </Button>
            </div>
            <div className="space-y-3 p-4">
              <Input
                placeholder="Search user by username/email..."
                value={authorSearch}
                onChange={(event) => setAuthorSearch(event.target.value)}
              />
              <div className="max-h-80 overflow-y-auto rounded-md border">
                {loadingAuthors && (
                  <p className="p-3 text-sm text-muted-foreground">Loading users...</p>
                )}
                {!loadingAuthors &&
                  authorOptions.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      className="flex w-full items-center justify-between border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                      onClick={() => {
                        setForm((p) => ({
                          ...p,
                          authorName: user.username,
                          authorEmail: user.email ?? "",
                        }));
                        setErrors((prev) => ({
                          ...prev,
                          authorName: undefined,
                          authorEmail: undefined,
                        }));
                        setAuthorPickerOpen(false);
                      }}
                    >
                      <span className="font-medium">{user.username}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </button>
                  ))}
                {!loadingAuthors && authorOptions.length === 0 && (
                  <p className="p-3 text-sm text-muted-foreground">No users found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
