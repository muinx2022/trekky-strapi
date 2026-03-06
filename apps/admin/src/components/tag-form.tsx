"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/app-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/rich-text-editor";
import { createTag, getTag, updateTag } from "@/lib/admin-api";
import { resolveRichTextMediaBeforeSave } from "@/lib/richtext-media";
import { slugify } from "@/lib/slug";

type TagFormProps = {
  mode: "create" | "edit";
  documentId?: string;
};

const emptyForm = {
  name: "",
  slug: "",
  aliases: "",
  description: "<p></p>",
};

type TagField = "name" | "slug";
type TagErrors = Partial<Record<TagField, string>>;

function splitAliases(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

export function TagForm({ mode, documentId }: TagFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<TagErrors>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (mode === "edit" && documentId) {
          const tag = await getTag(documentId);
          setForm({
            name: tag.name ?? "",
            slug: tag.slug ?? "",
            aliases: (tag.aliases ?? []).join(", "),
            description: tag.description ?? "<p></p>",
          });
          setSlugTouched(false);
        } else {
          setForm(emptyForm);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load tag");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [mode, documentId]);

  const validateForm = () => {
    const nextErrors: TagErrors = {};
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
        name: form.name.trim(),
        slug: form.slug.trim(),
        aliases: splitAliases(form.aliases),
        description,
      };
      if (mode === "edit" && documentId) {
        await updateTag(documentId, payload);
      } else {
        await createTag(payload);
      }
      toast({ title: mode === "edit" ? "Tag updated" : "Tag created", variant: "success" });
      router.push("/tags");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save tag");
      toast({
        title: "Failed to save tag",
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
          <CardTitle>{mode === "edit" ? "Edit Tag" : "Create Tag"}</CardTitle>
          <Button variant="outline" asChild>
            <Link href="/tags">Back to list</Link>
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
                setForm((prev) => ({
                  ...prev,
                  name: event.target.value,
                  slug: slugTouched ? prev.slug : slugify(event.target.value),
                }))
              }
              onBlur={() =>
                setErrors((prev) => ({ ...prev, name: form.name.trim() ? undefined : "Name is required" }))
              }
              required
            />
            <Input
              placeholder="Slug"
              value={form.slug}
              className={errors.slug ? "border-destructive focus-visible:ring-destructive/20" : ""}
              onChange={(event) => {
                setSlugTouched(true);
                setForm((prev) => ({ ...prev, slug: slugify(event.target.value) }));
              }}
              onBlur={() =>
                setErrors((prev) => ({ ...prev, slug: form.slug.trim() ? undefined : "Slug is required" }))
              }
              required
            />
            <Input
              placeholder="Aliases (comma separated)"
              value={form.aliases}
              onChange={(event) => setForm((prev) => ({ ...prev, aliases: event.target.value }))}
            />
            <RichTextEditor
              value={form.description}
              onChange={(description) => setForm((prev) => ({ ...prev, description }))}
              placeholder="Tag description..."
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
