import type { Metadata } from "next";
import { PostView } from "@/components/post-view";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "View Post",
};

type ViewPostPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function ViewPostPage({ params }: ViewPostPageProps) {
  const { documentId } = await params;
  return <PostView documentId={documentId} />;
}
