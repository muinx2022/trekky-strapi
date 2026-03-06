"use client";

import Link from "next/link";
import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Dices, ImagePlus, Search, UserX, X } from "lucide-react";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MultiSelectBox } from "@/components/multi-select-box";
import { PostAuthorPicker } from "@/components/post-author-picker";
import { RichTextEditor } from "@/components/rich-text-editor";
import { TagCombobox, type TagComboboxHandle, type TagOption } from "@/components/tag-combobox";
import {
  createTag,
  createPost,
  getRandomSeedUser,
  getPost,
  listAllCategories,
  listAllTags,
  updatePost,
  type CategoryItem,
  type MediaItem,
  type TagItem,
  type UserItem,
} from "@/lib/admin-api";
import { nameGalleryFile } from "@/lib/media-naming";
import { MAX_IMAGE_SIZE, MAX_VIDEO_SIZE, MAX_WIDTH, resizeToMaxWidth, uploadMediaFiles } from "@/lib/post-media";
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
  images: [] as MediaItem[],
  categoryDocumentIds: [] as string[],
  authorId: "",
  authorLabel: "",
};
type PostField = "title" | "slug";
type RequiredPostField = PostField | "author" | "category" | "content";
type RequiredPostErrors = Partial<Record<RequiredPostField, string>>;
const API_URL = "";

function resolveAssetUrl(url?: string | null) {
  if (!url) {
    return "";
  }
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_URL}${url}`;
}

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
  const tagComboboxRef = useRef<TagComboboxHandle>(null);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState<"content" | "img">("content");
  const [categoryOptions, setCategoryOptions] = useState<CategoryItem[]>([]);
  const [tagOptions, setTagOptions] = useState<TagItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<TagOption[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [authorModalOpen, setAuthorModalOpen] = useState(false);
  const [randomAuthorLoading, setRandomAuthorLoading] = useState(false);
  const [errors, setErrors] = useState<RequiredPostErrors>({});
  const [newMediaFiles, setNewMediaFiles] = useState<File[]>([]);
  const [newMediaPreviews, setNewMediaPreviews] = useState<string[]>([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<Set<number>>(new Set());
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [processingGallery, setProcessingGallery] = useState(false);

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
    const urls = newMediaFiles.map((file) => URL.createObjectURL(file));
    setNewMediaPreviews(urls);
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [newMediaFiles]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [categories, tags] = await Promise.all([listAllCategories(), listAllTags()]);
        setCategoryOptions(categories);
        setTagOptions(tags);

        if (mode === "edit" && documentId) {
          const post = await getPost(documentId);
          setForm({
            title: post.title ?? "",
            slug: post.slug ?? "",
            excerpt: post.excerpt ?? "",
            content: post.content ?? "<p></p>",
            images: post.images ?? [],
            categoryDocumentIds: (post.categories ?? []).map((item) => item.documentId),
            authorId: post.author?.id ? String(post.author.id) : "",
            authorLabel: post.author
              ? `${post.author.username}${post.author.email ? ` (${post.author.email})` : ""}`
              : "",
          });
          setSelectedTags((post.tags ?? []).map((item) => ({ documentId: item.documentId, name: item.name })));
          setSlugTouched(false);
          setRemovedMediaIds(new Set());
          setNewMediaFiles([]);
        } else {
          setForm(emptyForm);
          setSelectedTags([]);
          setRemovedMediaIds(new Set());
          setNewMediaFiles([]);
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
    await tagComboboxRef.current?.commitPending();
    if (!validateForm()) {
      toast({ title: "Please check input data", variant: "error" });
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let newUploadedIds: number[] = [];
      if (newMediaFiles.length > 0) {
        setUploadingMedia(true);
        const uploadedMedia = await uploadMediaFiles<MediaItem>(newMediaFiles);
        newUploadedIds = uploadedMedia
          .map((item) => item.id)
          .filter((id): id is number => typeof id === "number" && Number.isFinite(id));
        setUploadingMedia(false);
      }

      const content = await resolveRichTextMediaBeforeSave(form.content);
      const payload = {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        content,
        images: [
          ...form.images.filter((item) => !removedMediaIds.has(item.id)).map((item) => item.id),
          ...newUploadedIds,
        ].filter((id) => Number.isFinite(id)),
        categories: form.categoryDocumentIds,
        tags: Array.from(new Set(selectedTags.map((tag) => tag.documentId))),
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
      setUploadingMedia(false);
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
      setUploadingMedia(false);
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

  const onSelectRandomSeedAuthor = async () => {
    setRandomAuthorLoading(true);
    try {
      const user = await getRandomSeedUser();
      if (!user) {
        toast({
          title: "No seed user available",
          description: "Please run seed users first in Users > User seed tab.",
          variant: "error",
        });
        return;
      }
      onSelectAuthor(user);
      toast({
        title: "Random seed author selected",
        description: user.username,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed to select random seed user",
        description: error instanceof Error ? error.message : undefined,
        variant: "error",
      });
    } finally {
      setRandomAuthorLoading(false);
    }
  };

  const onSelectGalleryMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    const oversized = files.filter((file) =>
      (file.type.startsWith("image/") && file.size > MAX_IMAGE_SIZE) ||
      (file.type.startsWith("video/") && file.size > MAX_VIDEO_SIZE),
    );
    if (oversized.length > 0) {
      const message = `Image max ${MAX_IMAGE_SIZE / 1024 / 1024}MB, video max ${MAX_VIDEO_SIZE / 1024 / 1024}MB`;
      setError(message);
      toast({ title: "Upload failed", description: message, variant: "error" });
    }

    const validFiles = files.filter((file) =>
      (file.type.startsWith("image/") && file.size <= MAX_IMAGE_SIZE) ||
      (file.type.startsWith("video/") && file.size <= MAX_VIDEO_SIZE),
    );
    if (validFiles.length === 0) {
      return;
    }

    setProcessingGallery(true);
    try {
      const processed = await Promise.all(
        validFiles.map(async (file) => {
          const renamed = nameGalleryFile(file);
          return file.type.startsWith("image/") ? resizeToMaxWidth(renamed, MAX_WIDTH) : renamed;
        }),
      );
      setNewMediaFiles((prev) => [...prev, ...processed]);
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Failed to prepare gallery media";
      toast({ title: "Upload failed", description: message, variant: "error" });
    } finally {
      setProcessingGallery(false);
    }
  };

  const onRemoveImage = (imageId: number) => {
    setRemovedMediaIds((prev) => new Set([...prev, imageId]));
  };

  const onCreateTag = async (tagName: string) => {
    const normalizedName = tagName.trim();
    if (!normalizedName) {
      return null;
    }

    const normalizedSlug = slugify(normalizedName);
    const existing = tagOptions.find(
      (item) =>
        item.name.toLowerCase() === normalizedName.toLowerCase() || slugify(item.slug) === normalizedSlug,
    );

    if (existing) {
      return { documentId: existing.documentId, name: existing.name };
    }

    try {
      const created = await createTag({ name: normalizedName, slug: normalizedSlug });
      setTagOptions((prev) => [...prev, created]);
      return { documentId: created.documentId, name: created.name };
    } catch (createError) {
      const refreshed = await listAllTags();
      setTagOptions(refreshed);
      const fallback = refreshed.find(
        (item) =>
          item.name.toLowerCase() === normalizedName.toLowerCase() || slugify(item.slug) === normalizedSlug,
      );
      if (fallback) {
        return { documentId: fallback.documentId, name: fallback.name };
      }
      throw createError;
    }
  };

  const visibleExistingMedia = form.images.filter((item) => !removedMediaIds.has(item.id));
  const totalMediaCount = visibleExistingMedia.length + newMediaFiles.length;

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
            <div className="inline-flex rounded-md border bg-muted p-1">
              <button
                type="button"
                className={`rounded-sm px-3 py-1.5 text-sm ${
                  activeTab === "content" ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
                onClick={() => setActiveTab("content")}
              >
                Content
              </button>
              <button
                type="button"
                className={`rounded-sm px-3 py-1.5 text-sm ${activeTab === "img" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                onClick={() => setActiveTab("img")}
              >
                {totalMediaCount > 0 ? `Media (${totalMediaCount})` : "Media"}
              </button>
            </div>
            {activeTab === "content" && (
              <>
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
                      void onSelectRandomSeedAuthor();
                    }}
                    title="Assign random seed author"
                    aria-label="Assign random seed author"
                    disabled={randomAuthorLoading}
                  >
                    <Dices />
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
                <TagCombobox
                  ref={tagComboboxRef}
                  selected={selectedTags}
                  options={tagOptions.map((tag) => ({ documentId: tag.documentId, name: tag.name }))}
                  onChange={setSelectedTags}
                  onCreateTag={onCreateTag}
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
              </>
            )}
            {activeTab === "img" && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">Gallery media</p>
                  <label>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      onChange={(event) => {
                        void onSelectGalleryMedia(event);
                      }}
                    />
                    <span className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm hover:bg-accent">
                      <ImagePlus className="h-4 w-4" />
                      {processingGallery ? "Processing..." : "Add media"}
                    </span>
                  </label>
                </div>
                <p className="text-sm text-muted-foreground">
                  Images wider than {MAX_WIDTH}px are resized before upload. Images max 5MB, videos max 200MB.
                </p>
                {totalMediaCount > 0 ? (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    {visibleExistingMedia.map((image) => (
                      <div key={`existing-${image.id}`} className="group relative overflow-hidden rounded-md border bg-muted/20">
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
                        <button
                          type="button"
                          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => onRemoveImage(image.id)}
                          aria-label="Remove image"
                          title="Remove image"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {newMediaFiles.map((file, index) => (
                      <div key={`new-${index}`} className="group relative overflow-hidden rounded-md border bg-muted/20">
                        {file.type.startsWith("video/") ? (
                          <video src={newMediaPreviews[index]} className="aspect-square h-full w-full object-cover" controls />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={newMediaPreviews[index]}
                            alt={file.name}
                            className="aspect-square h-full w-full object-cover"
                          />
                        )}
                        <button
                          type="button"
                          className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/65 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => setNewMediaFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                          aria-label="Remove image"
                          title="Remove image"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No gallery media selected.</p>
                )}
              </div>
            )}
            <Button type="submit" disabled={saving || uploadingMedia || processingGallery}>
              {processingGallery
                ? "Processing media..."
                : uploadingMedia
                  ? "Uploading media..."
                  : saving
                    ? "Saving..."
                    : mode === "edit"
                      ? "Update"
                      : "Create"}
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
