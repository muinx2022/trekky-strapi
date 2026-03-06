import type { Metadata } from "next";
import { PostForm } from "@/components/post-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Add Post",
};

export default function NewPostPage() {
  return <PostForm mode="create" />;
}
