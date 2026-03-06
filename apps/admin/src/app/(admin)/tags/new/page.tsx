import type { Metadata } from "next";
import { TagForm } from "@/components/tag-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add Tag",
};

export default function NewTagPage() {
  return <TagForm mode="create" />;
}
