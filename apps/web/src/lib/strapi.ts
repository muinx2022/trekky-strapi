// STRAPI_INTERNAL_URL: server-side only, set this in Docker to reach Strapi via internal network
const API_URL = process.env.STRAPI_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

type StrapiListResponse<T> = {
  data: T[];
};

export type Category = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
  parent?: {
    documentId: string;
    name: string;
    slug: string;
  } | null;
  children?: Category[];
};

export type Tag = {
  id: number;
  documentId: string;
  name: string;
  slug: string;
  description?: string;
};

type CategoryNode = {
  documentId: string;
  slug: string;
  parent?: {
    documentId: string;
  } | null;
};

export type Comment = {
  id: number;
  documentId: string;
  authorName: string;
  authorAvatarUrl?: string | null;
  content: string;
  targetType: "post" | "page" | "product" | "other";
  targetDocumentId: string;
  createdAt: string;
  parent?: { documentId: string } | null;
};

export type StrapiImage = {
  id: number;
  url: string;
  mime?: string | null;
  alternativeText?: string | null;
  width?: number;
  height?: number;
  name?: string;
};

export type PostAuthor = {
  id: number;
  username: string;
  avatar?: StrapiImage | null;
};

export type Post = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  categories?: Category[];
  tags?: Tag[];
  images?: StrapiImage[];
  author?: PostAuthor;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  status?: "draft" | "published";
  commentsCount?: number;
  likesCount?: number;
};

async function strapiFetch<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 30 },
    });
  } catch (error) {
    console.error(`Failed to fetch from Strapi at ${API_URL}${path}:`, error);
    throw new Error(`Failed to connect to the Strapi API. Please ensure the API server is running at ${API_URL}`);
  }

  if (!response.ok) {
    throw new Error(`Strapi request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function strapiFetchNoStore<T>(path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
  } catch (error) {
    console.error(`Failed to fetch from Strapi at ${API_URL}${path}:`, error);
    throw new Error(`Failed to connect to the Strapi API. Please ensure the API server is running at ${API_URL}`);
  }

  if (!response.ok) {
    throw new Error(`Strapi request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function getPosts() {
  const query =
    "/api/posts?sort=createdAt:desc&populate[categories][fields][0]=name&populate[categories][fields][1]=slug&populate[tags][fields][0]=name&populate[tags][fields][1]=slug";
  const payload = await strapiFetch<StrapiListResponse<Post>>(query);
  return payload.data;
}

export async function getTopLevelCategories() {
  // Populate parent field so we can filter client-side (Strapi v5 null-relation filter may not work reliably)
  const payload = await strapiFetch<StrapiListResponse<Category>>(
    "/api/categories?populate[parent][fields][0]=id&sort=sortOrder:asc&sort=name:asc"
  );
  return payload.data.filter((cat) => !cat.parent);
}

export async function getPostsWithPagination(
  page: number = 1,
  pageSize: number = 10,
  categorySlug?: string,
  tagSlug?: string,
  authorUsername?: string,
) {
  let query = `/api/posts?sort=createdAt:desc&populate[categories][fields][0]=name&populate[categories][fields][1]=slug&populate[tags][fields][0]=name&populate[tags][fields][1]=slug&populate[images][fields][0]=url&populate[images][fields][1]=alternativeText&populate[author][fields][0]=id&populate[author][fields][1]=username&populate[author][populate][avatar][fields][0]=url&pagination[page]=${page}&pagination[pageSize]=${pageSize}`;

  if (categorySlug) {
    const categorySlugs = await getCategorySubtreeSlugs(categorySlug);
    if (categorySlugs.length > 0) {
      categorySlugs.forEach((slug, index) => {
        query += `&filters[categories][slug][$in][${index}]=${encodeURIComponent(slug)}`;
      });
    } else {
      query += `&filters[categories][slug][$eq]=${encodeURIComponent(categorySlug)}`;
    }
  }

  if (tagSlug) {
    query += `&filters[tags][slug][$eq]=${encodeURIComponent(tagSlug)}`;
  }

  if (authorUsername) {
    return getPostsByUsername(authorUsername, page, pageSize);
  }

  const payload = await strapiFetch<{ data: Post[]; meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } } }>(query);
  payload.data = await attachPostStats(payload.data);
  return payload;
}

export async function getPostsByUsername(
  username: string,
  page: number = 1,
  pageSize: number = 10,
) {
  const query = `/api/posts/by-username/${encodeURIComponent(username)}?page=${page}&pageSize=${pageSize}`;
  const payload = await strapiFetch<{ data: Post[]; meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } } }>(query);
  payload.data = await attachPostStats(payload.data);
  return payload;
}

export async function getPublishedPostsCount() {
  const payload = await strapiFetchNoStore<{
    meta?: { pagination?: { total?: number } };
  }>("/api/posts?pagination[page]=1&pagination[pageSize]=1&fields[0]=id");
  return payload.meta?.pagination?.total ?? 0;
}

type TargetIdRow = { targetDocumentId: string };
type PagedRowsResponse<T> = {
  data: T[];
  meta?: {
    pagination?: {
      page?: number;
      pageCount?: number;
      total?: number;
    };
  };
};

async function fetchAllTargetIds(baseQueryPath: string) {
  const pageSize = 1000;
  let page = 1;
  let pageCount = 1;
  const rows: string[] = [];

  while (page <= pageCount) {
    const payload = await strapiFetch<PagedRowsResponse<TargetIdRow>>(
      `${baseQueryPath}&fields[0]=targetDocumentId&pagination[page]=${page}&pagination[pageSize]=${pageSize}`,
    );
    rows.push(...(payload.data ?? []).map((item) => item.targetDocumentId).filter(Boolean));
    pageCount = payload.meta?.pagination?.pageCount ?? 1;
    page += 1;
  }

  return rows;
}

async function attachPostStats(posts: Post[]) {
  if (!posts.length) {
    return posts;
  }

  const inFilters = posts
    .map((post, index) => `&filters[targetDocumentId][$in][${index}]=${encodeURIComponent(post.documentId)}`)
    .join("");

  const idsQuery = posts
    .map((post, index) => `targetDocumentIds[${index}]=${encodeURIComponent(post.documentId)}`)
    .join("&");

  let commentTargetIds: string[] = [];
  let likesMap: Record<string, number> = {};

  try {
    commentTargetIds = await fetchAllTargetIds(`/api/comments?filters[targetType][$eq]=post${inFilters}`);
  } catch {
    commentTargetIds = [];
  }

  try {
    const countsPayload = await strapiFetch<{ data: { likes: Record<string, number> } }>(
      `/api/interactions/counts?targetType=post&${idsQuery}`,
    );
    likesMap = countsPayload?.data?.likes ?? {};
  } catch {
    likesMap = {};
  }

  const commentsCountMap = new Map<string, number>();
  for (const targetId of commentTargetIds) {
    commentsCountMap.set(targetId, (commentsCountMap.get(targetId) ?? 0) + 1);
  }

  return posts.map((post) => ({
    ...post,
    commentsCount: commentsCountMap.get(post.documentId) ?? 0,
    likesCount: likesMap[post.documentId] ?? 0,
  }));
}

async function getCategorySubtreeSlugs(categorySlug: string) {
  const payload = await strapiFetch<StrapiListResponse<CategoryNode>>(
    "/api/categories?fields[0]=documentId&fields[1]=slug&populate[parent][fields][0]=documentId&pagination[page]=1&pagination[pageSize]=1000",
  );

  const rows = payload.data;
  const root = rows.find((item) => item.slug === categorySlug);
  if (!root) {
    return [];
  }

  const childrenByParent = new Map<string, string[]>();
  for (const item of rows) {
    const parentId = item.parent?.documentId;
    if (!parentId) {
      continue;
    }
    const bucket = childrenByParent.get(parentId) ?? [];
    bucket.push(item.documentId);
    childrenByParent.set(parentId, bucket);
  }

  const slugMap = new Map<string, string>(rows.map((item) => [item.documentId, item.slug]));
  const visitedIds: string[] = [];
  const queue: string[] = [root.documentId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId || visitedIds.includes(currentId)) {
      continue;
    }

    visitedIds.push(currentId);
    const children = childrenByParent.get(currentId) ?? [];
    for (const childId of children) {
      queue.push(childId);
    }
  }

  return visitedIds.map((id) => slugMap.get(id)).filter(Boolean) as string[];
}

export async function getTopPosts(limit: number = 10) {
  const query = `/api/posts?sort=createdAt:desc&pagination[page]=1&pagination[pageSize]=${limit}&fields[0]=title&fields[1]=slug&fields[2]=documentId`;
  const payload = await strapiFetch<StrapiListResponse<Post>>(query);
  return await attachPostStats(payload.data);
}

export async function getTopTags(limit: number = 12) {
  const query =
    `/api/tags?sort=updatedAt:desc&pagination[page]=1&pagination[pageSize]=${limit}` +
    "&fields[0]=name&fields[1]=slug&fields[2]=documentId";
  const payload = await strapiFetch<StrapiListResponse<Tag>>(query);
  return payload.data;
}

export async function getPostBySlug(slug: string) {
  const query =
    `/api/posts?filters[slug][$eq]=${encodeURIComponent(slug)}` +
    "&populate[categories][fields][0]=name" +
    "&populate[categories][fields][1]=slug" +
    "&populate[tags][fields][0]=name" +
    "&populate[tags][fields][1]=slug" +
    "&populate[images][fields][0]=url&populate[images][fields][1]=alternativeText" +
    "&populate[author][fields][0]=id&populate[author][fields][1]=username" +
    "&populate[author][populate][avatar][fields][0]=url";

  const payload = await strapiFetch<StrapiListResponse<Post>>(query);
  return payload.data[0] ?? null;
}

export async function getTagBySlug(slug: string) {
  const payload = await strapiFetch<StrapiListResponse<Tag>>(
    "/api/tags?" +
      `filters[slug][$eq]=${encodeURIComponent(slug)}` +
      "&fields[0]=name&fields[1]=slug&fields[2]=documentId&fields[3]=description",
  );
  return payload.data[0] ?? null;
}

export async function getCommentsForTarget(
  targetType: Comment["targetType"],
  targetDocumentId: string,
) {
  const pageSize = 200;
  const baseQuery =
    `/api/comments?filters[targetType][$eq]=${encodeURIComponent(targetType)}` +
    `&filters[targetDocumentId][$eq]=${encodeURIComponent(targetDocumentId)}` +
    "&populate[parent][fields][0]=documentId" +
    "&sort=createdAt:asc";

  const first = await strapiFetchNoStore<{ data: Comment[]; meta?: { pagination?: { pageCount?: number } } }>(
    `${baseQuery}&pagination[page]=1&pagination[pageSize]=${pageSize}`,
  );

  const all = [...(first.data ?? [])];
  const pageCount = Math.max(1, first.meta?.pagination?.pageCount ?? 1);

  for (let page = 2; page <= pageCount; page += 1) {
    const next = await strapiFetchNoStore<StrapiListResponse<Comment>>(
      `${baseQuery}&pagination[page]=${page}&pagination[pageSize]=${pageSize}`,
    );
    all.push(...(next.data ?? []));
  }

  return all;
}

export async function getCategoryBySlug(slug: string) {
  const payload = await strapiFetch<StrapiListResponse<Category>>(
    "/api/categories?" +
      "fields[0]=name&fields[1]=slug&fields[2]=documentId&fields[3]=description" +
      "&populate[parent][fields][0]=documentId" +
      "&populate[parent][fields][1]=name" +
      "&populate[parent][fields][2]=slug" +
      "&pagination[page]=1&pagination[pageSize]=1000",
  );

  const rows = payload.data;
  const category = rows.find((item) => item.slug === slug) ?? null;
  if (!category) {
    return null;
  }

  const children = rows
    .filter((item) => item.parent?.documentId === category.documentId)
    .map((item) => ({
      id: item.id,
      documentId: item.documentId,
      name: item.name,
      slug: item.slug,
    })) as Category[];

  return {
    ...category,
    parent: category.parent
      ? {
          documentId: category.parent.documentId,
          name: category.parent.name,
          slug: category.parent.slug,
        }
      : null,
    children,
  };
}
export async function getPostByDocumentId(documentId: string) {
  try {
    const payload = await strapiFetchNoStore<StrapiListResponse<Post>>(
      `/api/posts?filters[documentId][$eq]=${documentId}&populate[categories][fields][0]=name&populate[categories][fields][1]=slug&populate[tags][fields][0]=documentId&populate[tags][fields][1]=name&populate[tags][fields][2]=slug&populate[images][fields][0]=url&populate[images][fields][1]=alternativeText&populate[author][fields][0]=id&populate[author][fields][1]=username&populate[author][populate][avatar][fields][0]=url`,
    );
    return payload.data[0] ?? null;
  } catch (error) {
    console.error("Error fetching post by documentId:", error);
    return null;
  }
}

export type StrapiPage = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  type: "home" | "footer";
  content?: string | null;
};

export async function getPageByType(type: "home" | "footer"): Promise<StrapiPage | null> {
  try {
    const payload = await strapiFetchNoStore<StrapiListResponse<StrapiPage>>(
      `/api/pages?filters[type][$eq]=${type}&pagination[pageSize]=1`,
    );
    return payload.data[0] ?? null;
  } catch {
    return null;
  }
}

export async function getFooterPages(): Promise<StrapiPage[]> {
  try {
    const payload = await strapiFetchNoStore<StrapiListResponse<StrapiPage>>(
      "/api/pages?filters[type][$eq]=footer&sort=title:asc&pagination[pageSize]=50",
    );
    return payload.data;
  } catch {
    return [];
  }
}

export async function getPageBySlug(slug: string): Promise<StrapiPage | null> {
  try {
    const payload = await strapiFetchNoStore<StrapiListResponse<StrapiPage>>(
      `/api/pages?filters[slug][$eq]=${encodeURIComponent(slug)}&pagination[pageSize]=1`,
    );
    return payload.data[0] ?? null;
  } catch {
    return null;
  }
}

type SitemapEntry = {
  slug: string;
  documentId?: string;
  updatedAt?: string;
};

async function getAllEntriesForSitemap(path: string): Promise<SitemapEntry[]> {
  const pageSize = 1000;
  let page = 1;
  let pageCount = 1;
  const entries: SitemapEntry[] = [];

  while (page <= pageCount) {
    const separator = path.includes("?") ? "&" : "?";
    const payload = await strapiFetch<{
      data: SitemapEntry[];
      meta?: { pagination?: { pageCount?: number } };
    }>(`${path}${separator}pagination[page]=${page}&pagination[pageSize]=${pageSize}`);
    entries.push(...(payload.data ?? []));
    pageCount = payload.meta?.pagination?.pageCount ?? 1;
    page += 1;
  }

  return entries;
}

export async function getPostsForSitemap() {
  return getAllEntriesForSitemap("/api/posts?fields[0]=slug&fields[1]=documentId&fields[2]=updatedAt&sort=updatedAt:desc");
}

export async function getCategoriesForSitemap() {
  return getAllEntriesForSitemap("/api/categories?fields[0]=slug&fields[1]=updatedAt&sort=updatedAt:desc");
}

export async function getTagsForSitemap() {
  return getAllEntriesForSitemap("/api/tags?fields[0]=slug&fields[1]=updatedAt&sort=updatedAt:desc");
}

export async function getPagesForSitemap() {
  return getAllEntriesForSitemap(
    "/api/pages?fields[0]=slug&fields[1]=updatedAt&filters[type][$eq]=footer&sort=updatedAt:desc",
  );
}
