const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";

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
  content: string;
  targetType: "post" | "page" | "product" | "other";
  targetDocumentId: string;
  createdAt: string;
  parent?: { documentId: string } | null;
};

export type Post = {
  id: number;
  documentId: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  categories?: Category[];
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
    "/api/posts?sort=publishedAt:desc&populate[categories][fields][0]=name&populate[categories][fields][1]=slug";
  const payload = await strapiFetch<StrapiListResponse<Post>>(query);
  return payload.data;
}

export async function getTopLevelCategories() {
  // Populate parent field so we can filter client-side (Strapi v5 null-relation filter may not work reliably)
  const payload = await strapiFetch<StrapiListResponse<Category>>(
    "/api/categories?populate[parent][fields][0]=id&sort=name:asc"
  );
  return payload.data.filter((cat) => !cat.parent);
}

export async function getPostsWithPagination(page: number = 1, pageSize: number = 10, categorySlug?: string) {
  let query = `/api/posts?sort=publishedAt:desc&populate[categories][fields][0]=name&populate[categories][fields][1]=slug&pagination[page]=${page}&pagination[pageSize]=${pageSize}`;
  
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
  
  const payload = await strapiFetch<{ data: Post[]; meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number } } }>(query);
  payload.data = await attachPostStats(payload.data);
  return payload;
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

  let commentTargetIds: string[] = [];
  let likeTargetIds: string[] = [];

  try {
    commentTargetIds = await fetchAllTargetIds(`/api/comments?filters[targetType][$eq]=post${inFilters}`);
  } catch {
    commentTargetIds = [];
  }

  try {
    likeTargetIds = await fetchAllTargetIds(
      `/api/interactions?filters[actionType][$eq]=like&filters[targetType][$eq]=post${inFilters}`,
    );
  } catch {
    likeTargetIds = [];
  }

  const commentsCountMap = new Map<string, number>();
  for (const targetId of commentTargetIds) {
    commentsCountMap.set(targetId, (commentsCountMap.get(targetId) ?? 0) + 1);
  }

  const likesCountMap = new Map<string, number>();
  for (const targetId of likeTargetIds) {
    likesCountMap.set(targetId, (likesCountMap.get(targetId) ?? 0) + 1);
  }

  return posts.map((post) => ({
    ...post,
    commentsCount: commentsCountMap.get(post.documentId) ?? 0,
    likesCount: likesCountMap.get(post.documentId) ?? 0,
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
  // Using newest posts as a proxy for top posts since Strapi doesn't natively sort by comment count out-of-the-box
  const query = `/api/posts?sort=createdAt:desc&pagination[limit]=${limit}`;
  const payload = await strapiFetch<StrapiListResponse<Post>>(query);
  return payload.data;
}

export async function getPostBySlug(slug: string) {
  const query =
    `/api/posts?filters[slug][$eq]=${encodeURIComponent(slug)}` +
    "&populate[categories][fields][0]=name" +
    "&populate[categories][fields][1]=slug";

  const payload = await strapiFetch<StrapiListResponse<Post>>(query);
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
    const payload = await strapiFetch<StrapiListResponse<Post>>(
      `/api/posts?filters[documentId][$eq]=${documentId}&populate=*`,
    );
    return payload.data[0] ?? null;
  } catch (error) {
    console.error("Error fetching post by documentId:", error);
    return null;
  }
}
