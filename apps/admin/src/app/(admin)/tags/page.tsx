import type { Metadata } from "next";
import { TagsManager } from "@/components/tags-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tags",
};

export default function TagsPage() {
  return <TagsManager />;
}
