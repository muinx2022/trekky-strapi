import type { Metadata } from "next";
import { CategoriesManager } from "@/components/categories-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Categories",
};

export default function CategoriesPage() {
  return <CategoriesManager />;
}
