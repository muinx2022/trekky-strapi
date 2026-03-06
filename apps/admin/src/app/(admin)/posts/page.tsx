import type { Metadata } from "next";
import { PostsManager } from "@/components/posts-manager";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Posts",
};

export default function PostsPage() {
  return <PostsManager />;
}
