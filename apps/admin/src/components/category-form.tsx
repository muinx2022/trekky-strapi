"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/rich-text-editor";
import { createCategory, getCategory, listAllCategories, updateCategory, type CategoryItem } from "@/lib/admin-api";
import { resolveRichTextMediaBeforeSave } from "@/lib/richtext-media";
import { slugify } from "@/lib/slug";

type CategoryFormProps = {
  mode: "create" | "edit";
  documentId?: string;
};

const emptyForm = {
  name: "",
  slug: "",
  description: "<p></p>",
  parentDocumentId: "",
};
type CategoryField = "name" | "slug";
type CategoryErrors = Partial<Record<CategoryField, string>>;

export function CategoryForm({ mode, documentId }: CategoryFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [parentOptions, setParentOptions] = useState<CategoryItem[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<CategoryErrors>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const categories = await listAllCategories();
        setParentOptions(categories.filter((item) => item.documentId !== documentId));

        if (mode === "edit" && documentId) {
          const category = await getCategory(documentId);
          setForm({
            name: category.name ?? "",
            slug: category.slug ?? "",
            description: category.description ?? "<p></p>",
            parentDocumentId: category.parent?.documentId ?? "",
          });
          setSlugTouched(false);
        } else {
          setForm(emptyForm);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load category");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [mode, documentId]);

  const validateForm = () => {
    const nextErrors: CategoryErrors = {};
    if (!form.name.trim()) {
      nextErrors.name = "Name is required";
    }
    if (!form.slug.trim()) {
      nextErrors.slug = "Slug is required";
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
      const description = await resolveRichTextMediaBeforeSave(form.description);
      const payload = {
        name: form.name,
        slug: form.slug,
        description,
        parent: form.parentDocumentId || null,
      };
      if (mode === "edit" && documentId) {
        await updateCategory(documentId, payload);
      } else {
        await createCategory(payload);
      }
      toast({
        title: mode === "edit" ? "Category updated" : "Category created",
        variant: "success",
      });
      router.push("/categories");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save category");
      toast({
        title: "Failed to save category",
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
          <CardTitle>{mode === "edit" ? "Edit Category" : "Create Category"}</CardTitle>
          <Button variant="outline" asChild>
            <Link href="/categories">Back to list</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        {!loading && (
          <form className="space-y-3" onSubmit={onSubmit} noValidate>
            <Input
              placeholder="Name"
              value={form.name}
              className={errors.name ? "border-destructive focus-visible:ring-destructive/20" : ""}
              onChange={(event) =>
                setForm((p) => ({
                  ...p,
                  name: event.target.value,
                  slug: slugTouched ? p.slug : slugify(event.target.value),
                }))
              }
              onBlur={() => {
                if (!form.name.trim()) {
                  setErrors((prev) => ({ ...prev, name: "Name is required" }));
                } else {
                  setErrors((prev) => ({ ...prev, name: undefined }));
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
                setForm((p) => ({ ...p, slug: slugify(event.target.value) }));
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
            <select
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              value={form.parentDocumentId}
              onChange={(event) =>
                setForm((p) => ({ ...p, parentDocumentId: event.target.value }))
              }
            >
              <option value="">No parent</option>
              {parentOptions.map((item) => (
                <option key={item.documentId} value={item.documentId}>
                  {item.name}
                </option>
              ))}
            </select>
            <RichTextEditor
              value={form.description}
              onChange={(description) => setForm((p) => ({ ...p, description }))}
              placeholder="Category description..."
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
