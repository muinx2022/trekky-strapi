import { CommentForm } from "@/components/comment-form";

export const dynamic = "force-dynamic";

export default function NewCommentPage() {
  return <CommentForm mode="create" />;
}
