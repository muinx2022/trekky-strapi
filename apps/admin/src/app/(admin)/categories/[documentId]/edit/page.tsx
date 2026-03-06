import type { Metadata } from "next";
import { CategoryForm } from "@/components/category-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit Category",
};

type EditCategoryPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const { documentId } = await params;
  return <CategoryForm mode="edit" documentId={documentId} />;
}
