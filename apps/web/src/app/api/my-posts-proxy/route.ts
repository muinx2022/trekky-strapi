import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:1337";
type PublishStatus = "published" | "draft";
type MePayload = { id?: number };
type PostRow = {
  id?: number;
  documentId?: string;
  title?: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string | null;
  categories?: Array<{ id?: number; documentId?: string; name?: string; slug?: string }>;
  tags?: Array<{ id?: number; documentId?: string; name?: string; slug?: string }>;
  images?: Array<{ id?: number; url?: string; mime?: string | null; alternativeText?: string | null; width?: number; height?: number }>;
};
type NormalizedPost = PostRow & { status: PublishStatus };
type CategoryLookupPayload = {
  data?: Array<{ id?: number; documentId?: string }>;
};
type FetchPostsByStatusResult =
  | { rows: NormalizedPost[] }
  | { error: NextResponse };

function slugify(input: string) {
  return input
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function resolveCurrentUser(authHeader: string) {
  const meRes = await fetch(`${API_URL}/api/users/me`, {
    headers: {
      Authorization: authHeader,
    },
    cache: "no-store",
  });

  if (!meRes.ok) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const mePayload = (await meRes.json()) as MePayload;
  if (!mePayload.id) {
    return { error: NextResponse.json({ error: "Cannot resolve current user" }, { status: 400 }) };
  }

  return { mePayload };
}

function sortPostsByLatest(rows: NormalizedPost[]) {
  return [...rows].sort((a, b) => {
    const aDate = new Date(a.updatedAt ?? a.publishedAt ?? a.createdAt ?? 0).getTime();
    const bDate = new Date(b.updatedAt ?? b.publishedAt ?? b.createdAt ?? 0).getTime();
    return bDate - aDate;
  });
}

async function fetchPostsByStatus(
  authHeader: string,
  authorId: number,
  status: PublishStatus,
): Promise<FetchPostsByStatusResult> {
  const query = new URLSearchParams({
    status,
    "pagination[page]": "1",
    "pagination[pageSize]": "1000",
  });

  const postsRes = await fetch(`${API_URL}/api/posts/my-posts?${query.toString()}`, {
    headers: {
      Authorization: authHeader,
    },
    cache: "no-store",
  });

  const postsPayload = (await postsRes.json().catch(() => ({}))) as {
    data?: PostRow[];
    error?: { message?: string };
  };

  if (!postsRes.ok) {
    return {
      error: NextResponse.json(
        { error: postsPayload.error?.message ?? "Fetch failed" },
        { status: postsRes.status },
      ),
    };
  }

  const rows = (postsPayload.data ?? []).map((item) => ({
    ...item,
    status,
    publishedAt: status === "published" ? item.publishedAt ?? null : null,
  })) as NormalizedPost[];

  return { rows };
}

function mergePostVersions(draftRows: NormalizedPost[], publishedRows: NormalizedPost[]) {
  const merged = new Map<string, NormalizedPost>();

  for (const row of draftRows) {
    if (!row.documentId) {
      continue;
    }
    merged.set(row.documentId, {
      ...row,
      status: "draft",
      publishedAt: null,
    });
  }

  for (const row of publishedRows) {
    if (!row.documentId) {
      continue;
    }

    const existing = merged.get(row.documentId);
    if (!existing) {
      merged.set(row.documentId, {
        ...row,
        status: "published",
        publishedAt: row.publishedAt ?? null,
      });
      continue;
    }

    merged.set(row.documentId, {
      ...existing,
      id: existing.id ?? row.id,
      slug: existing.slug ?? row.slug,
      categories: existing.categories ?? row.categories,
      tags: existing.tags ?? row.tags,
      status: "published",
      publishedAt: row.publishedAt ?? null,
    });
  }

  return sortPostsByLatest(Array.from(merged.values()));
}

async function fetchOwnedPost(
  authHeader: string,
  userId: number,
  documentId: string,
): Promise<{ post: NormalizedPost } | { error: NextResponse }> {
  const [publishedResult, draftResult] = await Promise.all([
    fetchPostsByStatus(authHeader, userId, "published"),
    fetchPostsByStatus(authHeader, userId, "draft"),
  ]);

  if ("error" in publishedResult) {
    return { error: publishedResult.error };
  }
  if ("error" in draftResult) {
    return { error: draftResult.error };
  }

  const mergedRows = mergePostVersions(draftResult.rows, publishedResult.rows);
  const merged = mergedRows.find((row) => row.documentId === documentId);

  if (!merged?.documentId) {
    return {
      error: NextResponse.json({ error: "Post not found" }, { status: 404 }),
    };
  }

  return { post: merged };
}

async function resolveCategoryIds(authHeader: string, categoryDocumentIds: string[]) {
  if (categoryDocumentIds.length === 0) {
    return [];
  }

  const categoriesQuery = new URLSearchParams({
    "fields[0]": "id",
    "fields[1]": "documentId",
    "pagination[page]": "1",
    "pagination[pageSize]": String(Math.max(20, categoryDocumentIds.length * 2)),
  });

  categoryDocumentIds.forEach((documentId, index) => {
    categoriesQuery.append(`filters[documentId][$in][${index}]`, documentId);
  });

  const categoriesRes = await fetch(`${API_URL}/api/categories?${categoriesQuery.toString()}`, {
    headers: {
      Authorization: authHeader,
    },
    cache: "no-store",
  });

  const categoriesPayload = (await categoriesRes.json().catch(() => ({}))) as CategoryLookupPayload;

  if (!categoriesRes.ok) {
    return [];
  }

  return (categoriesPayload.data ?? [])
    .map((item) => item.id)
    .filter((id): id is number => Number.isFinite(id));
}


async function publishDocument(authHeader: string, documentId: string) {
  const tryPaths = [
    `${API_URL}/api/posts/${documentId}/user-publish`,
    `${API_URL}/api/posts/${documentId}/actions/publish`,
    `${API_URL}/api/posts/${documentId}/publish`,
  ];

  for (const path of tryPaths) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
    });
    if (res.ok) {
      return true;
    }
  }

  const fallbackRes = await fetch(`${API_URL}/api/posts/${documentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      data: {
        publishedAt: new Date().toISOString(),
      },
    }),
  });
  return fallbackRes.ok;
}

async function unpublishDocument(authHeader: string, documentId: string) {
  const tryPaths = [
    `${API_URL}/api/posts/${documentId}/user-unpublish`,
    `${API_URL}/api/posts/${documentId}/actions/unpublish`,
    `${API_URL}/api/posts/${documentId}/unpublish`,
  ];

  for (const path of tryPaths) {
    const res = await fetch(path, {
      method: "POST",
      headers: {
        Authorization: authHeader,
      },
    });
    if (res.ok) {
      return true;
    }
  }

  const fallbackRes = await fetch(`${API_URL}/api/posts/${documentId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      data: {
        publishedAt: null,
      },
    }),
  });
  return fallbackRes.ok;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const documentId = String(searchParams.get("documentId") ?? "").trim();

  try {
    const resolved = await resolveCurrentUser(authHeader);
    if ("error" in resolved) {
      return resolved.error;
    }

    if (documentId) {
      const ownedPost = await fetchOwnedPost(authHeader, resolved.mePayload.id!, documentId);
      if ("error" in ownedPost) {
        return ownedPost.error;
      }
      return NextResponse.json({ data: ownedPost.post });
    }

    const [publishedResult, draftResult] = await Promise.all([
      fetchPostsByStatus(authHeader, resolved.mePayload.id!, "published"),
      fetchPostsByStatus(authHeader, resolved.mePayload.id!, "draft"),
    ]);

    if ("error" in publishedResult) {
      return publishedResult.error;
    }
    if ("error" in draftResult) {
      return draftResult.error;
    }

    const mergedRows = mergePostVersions(draftResult.rows, publishedResult.rows);
    const safePage = Math.max(1, page);
    const safePageSize = Math.max(1, pageSize);
    const total = mergedRows.length;
    const pageCount = Math.max(1, Math.ceil(total / safePageSize));
    const start = (safePage - 1) * safePageSize;
    const end = start + safePageSize;
    const data = mergedRows.slice(start, end);

    return NextResponse.json({
      data,
      meta: {
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          pageCount,
          total,
        },
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch my posts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    content?: string;
    categories?: string[];
    tags?: string[];
    imageIds?: number[];
  };

  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const categoryDocumentIds = Array.isArray(body.categories)
    ? body.categories
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];
  const tagDocumentIds = Array.isArray(body.tags)
    ? body.tags
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];
  const imageIds = Array.isArray(body.imageIds)
    ? body.imageIds.filter((id) => Number.isFinite(id))
    : [];

  if (!title || !content || content === "<p></p>") {
    return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
  }

  try {
    const resolved = await resolveCurrentUser(authHeader);
    if ("error" in resolved) {
      return resolved.error;
    }

    const baseSlug = slugify(title) || `post-${Date.now()}`;
    const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;
    const categoryIds = await resolveCategoryIds(authHeader, categoryDocumentIds);

    const createRes = await fetch(`${API_URL}/api/posts/user-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        data: {
          title,
          slug,
          content,
          categories: categoryIds,
          tags: tagDocumentIds,
          images: imageIds,
        },
      }),
    });

    const createPayload = await createRes.json().catch(() => ({}));
    if (!createRes.ok) {
      return NextResponse.json(
        { error: (createPayload as { error?: { message?: string } })?.error?.message ?? "Create failed" },
        { status: createRes.status },
      );
    }

    return NextResponse.json(createPayload, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    documentId?: string;
    title?: string;
    content?: string;
    categories?: string[];
    tags?: string[];
    imageIds?: number[];
  };

  const documentId = String(body.documentId ?? "").trim();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const categoryDocumentIds = Array.isArray(body.categories)
    ? body.categories
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];
  const tagDocumentIds = Array.isArray(body.tags)
    ? body.tags
        .map((item) => String(item ?? "").trim())
        .filter(Boolean)
    : [];
  const imageIds = Array.isArray(body.imageIds)
    ? body.imageIds.filter((id) => Number.isFinite(id))
    : undefined;

  if (!documentId || !title || !content || content === "<p></p>") {
    return NextResponse.json({ error: "documentId, title and content are required" }, { status: 400 });
  }

  try {
    const resolved = await resolveCurrentUser(authHeader);
    if ("error" in resolved) {
      return resolved.error;
    }

    const ownedPost = await fetchOwnedPost(authHeader, resolved.mePayload.id!, documentId);
    if ("error" in ownedPost) {
      return ownedPost.error;
    }

    const categoryIds = await resolveCategoryIds(authHeader, categoryDocumentIds);

    const updateRes = await fetch(`${API_URL}/api/posts/${documentId}/user-update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        data: {
          title,
          content,
          categories: categoryIds,
          tags: tagDocumentIds,
          ...(imageIds !== undefined && { images: imageIds }),
        },
      }),
    });

    const updatePayload = (await updateRes.json().catch(() => ({}))) as {
      data?: PostRow;
      error?: { message?: string };
    };

    if (!updateRes.ok) {
      return NextResponse.json(
        { error: updatePayload.error?.message ?? "Update failed" },
        { status: updateRes.status },
      );
    }

    const refreshed = await fetchOwnedPost(authHeader, resolved.mePayload.id!, ownedPost.post.documentId ?? documentId);
    if ("error" in refreshed) {
      return NextResponse.json(updatePayload);
    }

    return NextResponse.json({ data: refreshed.post });
  } catch {
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    documentId?: string;
    action?: "toggle" | "publish" | "unpublish";
    currentStatus?: PublishStatus;
  };

  const documentId = String(body.documentId ?? "").trim();
  if (!documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  }

  try {
    const resolved = await resolveCurrentUser(authHeader);
    if ("error" in resolved) {
      return resolved.error;
    }

    const ownedPost = await fetchOwnedPost(authHeader, resolved.mePayload.id!, documentId);
    if ("error" in ownedPost) {
      return ownedPost.error;
    }

    const currentStatus = body.currentStatus ?? ownedPost.post.status ?? "draft";
    const shouldPublish =
      body.action === "publish" || (body.action !== "unpublish" && currentStatus !== "published");

    const ok = shouldPublish
      ? await publishDocument(authHeader, documentId)
      : await unpublishDocument(authHeader, documentId);

    if (!ok) {
      return NextResponse.json({ error: "Cannot change post status" }, { status: 400 });
    }

    const refreshed = await fetchOwnedPost(authHeader, resolved.mePayload.id!, documentId);
    if ("error" in refreshed) {
      return refreshed.error;
    }

    return NextResponse.json({ data: refreshed.post });
  } catch {
    return NextResponse.json({ error: "Failed to toggle post status" }, { status: 500 });
  }
}
