import type { Metadata } from "next";
import { CategoryForm } from "@/components/category-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add Category",
};

export default function NewCategoryPage() {
  return <CategoryForm mode="create" />;
}
