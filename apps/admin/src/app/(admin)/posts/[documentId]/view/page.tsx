import { PostView } from "@/components/post-view";

export const dynamic = "force-dynamic";

type ViewPostPageProps = {
  params: Promise<{ documentId: string }>;
};

export default async function ViewPostPage({ params }: ViewPostPageProps) {
  const { documentId } = await params;
  return <PostView documentId={documentId} />;
}
