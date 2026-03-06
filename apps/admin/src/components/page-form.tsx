"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/rich-text-editor";
import { createPage, getPage, updatePage, type PageType } from "@/lib/admin-api";
import { resolveRichTextMediaBeforeSave } from "@/lib/richtext-media";
import { slugify } from "@/lib/slug";

type PageFormProps = {
  mode: "create" | "edit";
  documentId?: string;
};

const emptyForm = {
  title: "",
  slug: "",
  type: "home" as PageType,
  content: "<p></p>",
};

type PageField = "title" | "slug" | "type";
type PageErrors = Partial<Record<PageField, string>>;

export function PageForm({ mode, documentId }: PageFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<PageErrors>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (mode === "edit" && documentId) {
          const page = await getPage(documentId);
          setForm({
            title: page.title ?? "",
            slug: page.slug ?? "",
            type: (page.type as PageType) ?? "home",
            content: page.content ?? "<p></p>",
          });
          setSlugTouched(false);
        } else {
          setForm(emptyForm);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load page");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [mode, documentId]);

  const validateForm = () => {
    const nextErrors: PageErrors = {};
    if (!form.title.trim()) {
      nextErrors.title = "Title is required";
    }
    if (!form.slug.trim()) {
      nextErrors.slug = "Slug is required";
    }
    if (!form.type.trim()) {
      nextErrors.type = "Type is required";
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
        title: form.title.trim(),
        slug: form.slug.trim(),
        type: form.type,
        content,
      };
      if (mode === "edit" && documentId) {
        await updatePage(documentId, payload);
      } else {
        await createPage(payload);
      }
      toast({
        title: mode === "edit" ? "Page updated" : "Page created",
        variant: "success",
      });
      router.push("/pages");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save page";
      setError(message);
      toast({
        title: "Failed to save page",
        description: message,
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
          <CardTitle>{mode === "edit" ? "Edit Page" : "Create Page"}</CardTitle>
          <Button variant="outline" asChild>
            <Link href="/pages">Back to list</Link>
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
                setForm((prev) => ({
                  ...prev,
                  title: nextTitle,
                  slug: nextSlug,
                }));
                setErrors((prev) => ({
                  ...prev,
                  title: nextTitle.trim() ? undefined : prev.title,
                  slug: nextSlug.trim() ? undefined : prev.slug,
                }));
              }}
              onBlur={() =>
                setErrors((prev) => ({ ...prev, title: form.title.trim() ? undefined : "Title is required" }))
              }
              required
            />
            <Input
              placeholder="Slug"
              value={form.slug}
              className={errors.slug ? "border-destructive focus-visible:ring-destructive/20" : ""}
              onChange={(event) => {
                setSlugTouched(true);
                const nextSlug = slugify(event.target.value);
                setForm((prev) => ({ ...prev, slug: nextSlug }));
                if (nextSlug.trim()) {
                  setErrors((prev) => ({ ...prev, slug: undefined }));
                }
              }}
              onBlur={() =>
                setErrors((prev) => ({ ...prev, slug: form.slug.trim() ? undefined : "Slug is required" }))
              }
              required
            />
            <select
              className={`h-10 w-full rounded-md border bg-background px-3 text-sm ${
                errors.type ? "border-destructive" : ""
              }`}
              value={form.type}
              onChange={(event) => {
                const value = event.target.value as PageType;
                setForm((prev) => ({ ...prev, type: value }));
                if (value.trim()) {
                  setErrors((prev) => ({ ...prev, type: undefined }));
                }
              }}
              onBlur={() =>
                setErrors((prev) => ({ ...prev, type: form.type.trim() ? undefined : "Type is required" }))
              }
              required
            >
              <option value="home">home</option>
              <option value="footer">footer</option>
            </select>
            <RichTextEditor
              value={form.content}
              onChange={(content) => setForm((prev) => ({ ...prev, content }))}
              placeholder="Page content..."
            />
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : mode === "edit" ? "Update" : "Create"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
