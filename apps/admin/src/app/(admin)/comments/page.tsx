import type { Metadata } from "next";
import { CommentsManager } from "@/components/comments-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Comments",
};

export default function CommentsPage() {
  return <CommentsManager />;
}
