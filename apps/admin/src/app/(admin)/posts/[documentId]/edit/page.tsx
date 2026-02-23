import { PostForm } from "@/components/post-form";

export const dynamic = "force-dynamic";

type EditPostPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { documentId } = await params;
  return <PostForm mode="edit" documentId={documentId} />;
}
