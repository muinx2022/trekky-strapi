import { PostForm } from "@/components/post-form";

export const dynamic = "force-dynamic";

export default function NewPostPage() {
  return <PostForm mode="create" />;
}
