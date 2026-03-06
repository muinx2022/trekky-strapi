import type { Metadata } from "next";
import Image from "next/image";
import { getPostsWithPagination } from "@/lib/strapi";
import { InfinitePosts } from "@/components/infinite-posts";
import { SITE_URL, SITE_NAME, buildOgImages, toAbsoluteMediaUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

type UserPageProps = {
  params: Promise<{ username: string }>;
};

export async function generateMetadata({ params }: UserPageProps): Promise<Metadata> {
  const { username } = await params;
  const canonical = `${SITE_URL}/u/${username}`;
  const description = `Xem các bài viết của ${username} trên ${SITE_NAME}.`;

  return {
    title: username,
    description,
    alternates: { canonical },
    openGraph: {
      type: "profile",
      url: canonical,
      title: username,
      description,
      siteName: SITE_NAME,
      locale: "vi_VN",
      images: buildOgImages(undefined),
    },
    twitter: {
      card: "summary",
      title: username,
      description,
    },
  };
}

export default async function UserPage({
  params,
}: UserPageProps) {
  const { username } = await params;

  const data = await getPostsWithPagination(1, 10, undefined, undefined, username);
  const posts = data?.data || [];
  const total = data?.meta?.pagination?.total || 0;
  const authorAvatarUrl = toAbsoluteMediaUrl(posts[0]?.author?.avatar?.url);

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white border border-gray-200 p-6 flex items-center gap-4">
        {authorAvatarUrl ? (
          <Image
            src={authorAvatarUrl}
            alt={`${username} avatar`}
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover bg-gray-300 shrink-0"
            unoptimized
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gray-300 flex items-center justify-center text-2xl font-bold text-gray-600 shrink-0">
            {username[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{username}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} bài viết</p>
        </div>
      </div>

      <section>
        <InfinitePosts initialPosts={posts} initialTotal={total} authorUsername={username} />
      </section>
    </div>
  );
}
