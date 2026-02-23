"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, UserX } from "lucide-react";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MultiSelectBox } from "@/components/multi-select-box";
import { PostAuthorPicker } from "@/components/post-author-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  createPost,
  getPost,
  listAllCategories,
  updatePost,
  type CategoryItem,
  type UserItem,
} from "@/lib/admin-api";
import { resolveRichTextMediaBeforeSave } from "@/lib/richtext-media";
import { slugify } from "@/lib/slug";

type PostFormProps = {
  mode: "create" | "edit";
  documentId?: string;
};

const emptyForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "<p></p>",
  categoryDocumentIds: [] as string[],
  authorId: "",
  authorLabel: "",
};
type PostField = "title" | "slug";
type RequiredPostField = PostField | "author" | "category" | "content";
type RequiredPostErrors = Partial<Record<RequiredPostField, string>>;

function hasContent(value: string) {
  const text = value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  if (text.length > 0) {
    return true;
  }
  return /<(img|iframe|video|figure|embed)\b/i.test(value);
}

export function PostForm({ mode, documentId }: PostFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [categoryOptions, setCategoryOptions] = useState<CategoryItem[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [authorModalOpen, setAuthorModalOpen] = useState(false);
  const [errors, setErrors] = useState<RequiredPostErrors>({});

  const categoryTreeOptions = useMemo(() => {
    const byParent = new Map<number | null, CategoryItem[]>();
    for (const item of categoryOptions) {
      const parentId = item.parent?.id ?? null;
      const bucket = byParent.get(parentId) ?? [];
      bucket.push(item);
      byParent.set(parentId, bucket);
    }

    for (const bucket of byParent.values()) {
      bucket.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }

    const flattened: Array<{ value: string; label: string; depth: number }> = [];
    const visit = (parentId: number | null, level: number) => {
      const nodes = byParent.get(parentId) ?? [];
      for (const node of nodes) {
        flattened.push({
          value: node.documentId,
          label: node.name,
          depth: level,
        });
        visit(node.id, level + 1);
      }
    };

    visit(null, 0);
    return flattened;
  }, [categoryOptions]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const categories = await listAllCategories();
        setCategoryOptions(categories);

        if (mode === "edit" && documentId) {
          const post = await getPost(documentId);
          setForm({
            title: post.title ?? "",
            slug: post.slug ?? "",
            excerpt: post.excerpt ?? "",
            content: post.content ?? "<p></p>",
            categoryDocumentIds: (post.categories ?? []).map((item) => item.documentId),
            authorId: post.author?.id ? String(post.author.id) : "",
            authorLabel: post.author
              ? `${post.author.username}${post.author.email ? ` (${post.author.email})` : ""}`
              : "",
          });
          setSlugTouched(false);
        } else {
          setForm(emptyForm);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load post");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [mode, documentId]);

  const validateForm = () => {
    const nextErrors: RequiredPostErrors = {};
    if (!form.title.trim()) {
      nextErrors.title = "Title is required";
    }
    if (!form.slug.trim()) {
      nextErrors.slug = "Slug is required";
    }
    if (!form.authorId) {
      nextErrors.author = "Author is required";
    }
    if (form.categoryDocumentIds.length === 0) {
      nextErrors.category = "Category is required";
    }
    if (!hasContent(form.content)) {
      nextErrors.content = "Content is required";
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
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content,
        categories: form.categoryDocumentIds,
        author: form.authorId ? Number(form.authorId) : null,
      };
      if (mode === "edit" && documentId) {
        await updatePost(documentId, payload);
      } else {
        await createPost(payload);
      }
      toast({
        title: mode === "edit" ? "Post updated" : "Post created",
        variant: "success",
      });
      router.push("/posts");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save post";
      setError(message);
      if (message.includes("plugin::users-permissions.user")) {
        setErrors((prev) => ({ ...prev, author: "Author is invalid" }));
      }
      toast({
        title: "Failed to save post",
        description:
          message.includes("plugin::users-permissions.user")
            ? "Selected author no longer exists. Please choose another author."
            : message,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const onSelectAuthor = (user: UserItem) => {
    setForm((p) => ({
      ...p,
      authorId: String(user.id),
      authorLabel: `${user.username}${user.email ? ` (${user.email})` : ""}`,
    }));
    setErrors((prev) => ({ ...prev, author: undefined }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{mode === "edit" ? "Edit Post" : "Create Post"}</CardTitle>
          <Button variant="outline" asChild>
            <Link href="/posts">Back to list</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {!loading && (
          <form className="space-y-3" onSubmit={onSubmit} noValidate>
            <Input
              placeholder="Title"
              value={form.title}
              className={errors.title ? "border-destructive focus-visible:ring-destructive/20" : ""}
              onChange={(event) => {
                const nextTitle = event.target.value;
                const nextSlug = slugTouched ? form.slug : slugify(nextTitle);
                setForm((p) => ({
                  ...p,
                  title: nextTitle,
                  slug: nextSlug,
                }));
                setErrors((prev) => ({
                  ...prev,
                  title: nextTitle.trim() ? undefined : prev.title,
                  slug: nextSlug.trim() ? undefined : prev.slug,
                }));
              }}
              onBlur={() => {
                if (!form.title.trim()) {
                  setErrors((prev) => ({ ...prev, title: "Title is required" }));
                } else {
                  setErrors((prev) => ({ ...prev, title: undefined }));
                }
              }}
              required
            />
            <Input
              placeholder="Slug"
              value={form.slug}
              className={errors.slug ? "border-destructive focus-visible:ring-destructive/20" : ""}
              onChange={(event) => {
                setSlugTouched(true);
                const nextSlug = slugify(event.target.value);
                setForm((p) => ({ ...p, slug: nextSlug }));
                if (nextSlug.trim()) {
                  setErrors((prev) => ({ ...prev, slug: undefined }));
                }
              }}
              onBlur={() => {
                if (!form.slug.trim()) {
                  setErrors((prev) => ({ ...prev, slug: "Slug is required" }));
                } else {
                  setErrors((prev) => ({ ...prev, slug: undefined }));
                }
              }}
              required
            />
            <div className="flex items-center gap-2">
              <Input
                value={form.authorLabel}
                placeholder="No author selected"
                readOnly
                className={errors.author ? "border-destructive focus-visible:ring-destructive/20" : ""}
                onBlur={() => {
                  if (!form.authorId) {
                    setErrors((prev) => ({ ...prev, author: "Author is required" }));
                  } else {
                    setErrors((prev) => ({ ...prev, author: undefined }));
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => setAuthorModalOpen(true)}
                title="Select author"
                aria-label="Select author"
              >
                <Search />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={() => {
                  setForm((p) => ({ ...p, authorId: "", authorLabel: "" }));
                  setErrors((prev) => ({ ...prev, author: "Author is required" }));
                }}
                title="Clear author"
                aria-label="Clear author"
                disabled={!form.authorId}
              >
                <UserX />
              </Button>
            </div>
            <MultiSelectBox
              options={categoryTreeOptions}
              value={form.categoryDocumentIds}
              className={errors.category ? "border-destructive focus-visible:ring-destructive/20" : ""}
              onChange={(next) => {
                setForm((p) => ({ ...p, categoryDocumentIds: next }));
                if (next.length > 0) {
                  setErrors((prev) => ({ ...prev, category: undefined }));
                }
              }}
              onBlur={() => {
                if (form.categoryDocumentIds.length === 0) {
                  setErrors((prev) => ({ ...prev, category: "Category is required" }));
                } else {
                  setErrors((prev) => ({ ...prev, category: undefined }));
                }
              }}
              placeholder="Select categories"
            />
            <Input
              placeholder="Excerpt"
              value={form.excerpt}
              onChange={(event) => setForm((p) => ({ ...p, excerpt: event.target.value }))}
            />
            <RichTextEditor
              value={form.content}
              className={errors.content ? "border-destructive" : ""}
              onChange={(content) => {
                setForm((p) => ({ ...p, content }));
                if (hasContent(content)) {
                  setErrors((prev) => ({ ...prev, content: undefined }));
                }
              }}
              onBlur={() => {
                if (!hasContent(form.content)) {
                  setErrors((prev) => ({ ...prev, content: "Content is required" }));
                } else {
                  setErrors((prev) => ({ ...prev, content: undefined }));
                }
              }}
              placeholder="Write post content..."
            />
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : mode === "edit" ? "Update" : "Create"}
            </Button>
          </form>
        )}
        <PostAuthorPicker
          open={authorModalOpen}
          onClose={() => setAuthorModalOpen(false)}
          onSelect={onSelectAuthor}
        />
      </CardContent>
    </Card>
  );
}
