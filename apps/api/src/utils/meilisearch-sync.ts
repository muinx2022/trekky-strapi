const POSTS_INDEX = 'posts';

type SearchPostDocument = {
  _meilisearch_id: string;
  id: number;
  documentId: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  publishedAt?: string | null;
};

function getMeiliConfig() {
  const host = process.env.MEILISEARCH_HOST ?? 'http://localhost:7700';
  const apiKey = process.env.MEILI_MASTER_KEY ?? '';
  return { host: host.replace(/\/+$/, ''), apiKey };
}

async function meiliRequest(path: string, init?: RequestInit) {
  const { host, apiKey } = getMeiliConfig();
  const headers: HeadersInit = {
    'content-type': 'application/json',
    ...(apiKey ? { 'X-Meili-API-Key': apiKey } : {}),
    ...(init?.headers ?? {}),
  };

  const response = await fetch(`${host}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Meili request failed: ${response.status} ${response.statusText} ${text}`);
  }
}

export async function upsertPostSearchDocument(document: SearchPostDocument) {
  await meiliRequest(`/indexes/${POSTS_INDEX}/documents`, {
    method: 'POST',
    body: JSON.stringify([document]),
  });
}

export async function deletePostSearchDocumentById(id: number) {
  await meiliRequest(`/indexes/${POSTS_INDEX}/documents/${id}`, {
    method: 'DELETE',
  });
}

