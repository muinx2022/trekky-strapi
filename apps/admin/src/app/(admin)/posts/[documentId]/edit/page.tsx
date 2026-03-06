import type { Metadata } from "next";
import { PostForm } from "@/components/post-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Edit Post",
};

type EditPostPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function EditPostPage({ params }: EditPostPageProps) {
  const { documentId } = await params;
  return <PostForm mode="edit" documentId={documentId} />;
}
