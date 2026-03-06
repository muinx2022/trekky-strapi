import type { Metadata } from "next";
import { CommentForm } from "@/components/comment-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add Comment",
};

export default function NewCommentPage() {
  return <CommentForm mode="create" />;
}
