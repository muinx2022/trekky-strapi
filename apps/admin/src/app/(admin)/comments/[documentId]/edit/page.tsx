import { CommentForm } from "@/components/comment-form";

export const dynamic = "force-dynamic";

type EditCommentPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function EditCommentPage({ params }: EditCommentPageProps) {
  const { documentId } = await params;
  return <CommentForm mode="edit" documentId={documentId} />;
}
