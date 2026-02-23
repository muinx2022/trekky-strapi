import { notFound } from "next/navigation";
import { getCommentsForTarget, getPostByDocumentId } from "@/lib/strapi";
import { RichTextContent } from "@/components/rich-text-content";
import { PostActions } from "@/components/post-actions";
import { GenericComments } from "@/components/generic-comments";

export const dynamic = "force-dynamic";

type PostPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PostPage({ params }: PostPageProps) {
  const { id } = await params;
  
  // Extract documentId from slug--documentId pattern
  // e.g., "hello-msg--abcdef123" -> "abcdef123"
  // If no "--" is found, assume the entire string is the documentId
  const documentId = id.includes("--") ? id.split("--").pop() : id;

  if (!documentId) {
    notFound();
  }

  const post = await getPostByDocumentId(documentId);

  if (!post) {
    notFound();
  }

  const comments = await getCommentsForTarget("post", post.documentId);

  return (
    <div className="space-y-8">
      <article>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{post.title}</h1>
        {post.excerpt && <p className="mt-3 text-zinc-600 dark:text-zinc-400">{post.excerpt}</p>}
        <div className="mt-6 flex flex-wrap gap-2">
          {(post.categories ?? []).map((category) => (
            <span
              key={category.documentId}
              className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300"
            >
              {category.name}
            </span>
          ))}
        </div>
        <div className="mt-8 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6">
          <RichTextContent html={post.content} className="richtext-content text-zinc-700 dark:text-zinc-300" />
        </div>
      </article>

      <PostActions targetType="post" targetDocumentId={post.documentId} />

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 mb-6">Comments</h2>
        <GenericComments 
          targetType="post" 
          targetDocumentId={post.documentId} 
          initialComments={comments} 
        />
      </section>
    </div>
  );
}
