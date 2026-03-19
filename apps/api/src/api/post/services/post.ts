import { factories } from '@strapi/strapi';
import { deletePostSearchDocumentById, upsertPostSearchDocument } from '../../../utils/meilisearch-sync';

const UID = 'api::post.post';
const COMMENT_UID = 'api::comment.comment';

function toPagination(query: any) {
  const page = Math.max(1, Number(query?.pagination?.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pagination?.pageSize ?? 10) || 10));
  return { page, pageSize };
}

function toStatus(status: unknown): 'draft' | 'published' | undefined {
  return status === 'draft' || status === 'published' ? status : undefined;
}

function andFilters(a: any, b: any) {
  if (a && b) return { $and: [a, b] };
  return a ?? b;
}

async function syncPublishedPostToSearch(strapi: any, documentId: string) {
  try {
    const published = await strapi.documents(UID).findOne({
      documentId,
      status: 'published',
      fields: ['id', 'documentId', 'title', 'slug', 'excerpt', 'publishedAt'],
    });

    if (!published?.id) return;

    await upsertPostSearchDocument({
      _meilisearch_id: String(published.id),
      id: published.id,
      documentId: published.documentId,
      title: published.title,
      slug: published.slug,
      excerpt: published.excerpt ?? null,
      publishedAt: published.publishedAt ?? null,
    });
  } catch (error) {
    strapi.log.warn(`[meilisearch] Failed to sync published post ${documentId}: ${String(error)}`);
  }
}

async function removePostFromSearch(strapi: any, id: number | null | undefined, documentId: string) {
  if (!id) return;
  try {
    await deletePostSearchDocumentById(id);
  } catch (error) {
    strapi.log.warn(`[meilisearch] Failed to remove post ${documentId} from search: ${String(error)}`);
  }
}

async function findAllDocumentIdsByStatus(
  strapi: any,
  status: 'draft' | 'published',
  filters: any,
) {
  const pageSize = 1000;
  let page = 1;
  const ids: string[] = [];

  while (true) {
    const batch = (await strapi.documents(UID).findMany({
      sort: 'createdAt:desc',
      filters,
      fields: ['documentId'],
      pagination: { page, pageSize },
      status,
    })) as Array<{ documentId: string }>;

    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    ids.push(...batch.map((entry) => entry.documentId).filter((id): id is string => Boolean(id)));

    if (batch.length < pageSize) {
      break;
    }
    page += 1;
  }

  return ids;
}

export default factories.createCoreService(UID, ({ strapi }) => ({
  async listForAdmin(query: any) {
    const { page, pageSize } = toPagination(query);
    const sort = query?.sort ?? 'createdAt:desc';
    const status = toStatus(query?.status);
    const keyword = String(query?.q ?? '').trim();
    const keywordFilters = keyword
      ? {
          $or: [
            { title: { $containsi: keyword } },
            { slug: { $containsi: keyword } },
            { excerpt: { $containsi: keyword } },
          ],
        }
      : undefined;
    const filters = query?.filters
      ? keywordFilters
        ? { $and: [query.filters, keywordFilters] }
        : query.filters
      : keywordFilters;

    let effectiveFilters = filters;
    if (status === 'draft') {
      const publishedDocumentIds = await findAllDocumentIdsByStatus(strapi, 'published', filters);
      if (publishedDocumentIds.length > 0) {
        effectiveFilters = andFilters(filters, {
          documentId: { $notIn: publishedDocumentIds },
        });
      }
    }

    const [data, total] = await Promise.all([
      strapi.documents(UID).findMany({
        sort,
        filters: effectiveFilters,
        populate: query?.populate,
        pagination: { page, pageSize },
        status,
      }),
      strapi.documents(UID).count({ status, filters: effectiveFilters }),
    ]);

    const enriched = await Promise.all(
      (data as any[]).map(async (item) => {
        const commentCount = await strapi.documents(COMMENT_UID).count({
          filters: {
            targetType: { $eq: 'post' },
            targetDocumentId: { $eq: item.documentId },
          },
        });

        const publishedVersion = await strapi.documents(UID).findOne({
          documentId: item.documentId,
          status: 'published',
          fields: ['publishedAt'],
        });

        return {
          ...item,
          publishedAt: publishedVersion?.publishedAt ?? null,
          categoriesCount: Array.isArray(item.categories) ? item.categories.length : 0,
          commentsCount: commentCount,
        };
      }),
    );

    return {
      data: enriched,
      meta: {
        pagination: {
          page,
          pageSize,
          pageCount: Math.max(1, Math.ceil(total / pageSize)),
          total,
        },
      },
    };
  },

  async findOneForAdmin(documentId: string, query: any) {
    return strapi.documents(UID).findOne({
      documentId,
      populate: query?.populate,
      fields: query?.fields,
      status: toStatus(query?.status),
      locale: query?.locale,
    });
  },

  async createForAdmin(payload: any) {
    const data = { ...(payload ?? {}) };
    if ('author' in data) {
      const authorId = Number(data.author);
      data.author = Number.isFinite(authorId) ? authorId : null;
    }
    return strapi.documents(UID).create({
      data,
      status: 'draft',
    });
  },

  async updateForAdmin(documentId: string, payload: any) {
    const data = { ...(payload ?? {}) };
    if ('author' in data) {
      const authorId = Number(data.author);
      data.author = Number.isFinite(authorId) ? authorId : null;
    }
    let wasPublished = false;
    try {
      const published = await strapi.documents(UID).findOne({
        documentId,
        status: 'published',
        fields: ['publishedAt'],
      });
      wasPublished = Boolean(published);
    } catch {
      wasPublished = false;
    }

    const updated = await strapi.documents(UID).update({
      documentId,
      data,
    });

    if (wasPublished) {
      const documentsApi = strapi.documents(UID) as any;
      if (typeof documentsApi.unpublish === 'function' && typeof documentsApi.publish === 'function') {
        await documentsApi.unpublish({ documentId });
        const result = await documentsApi.publish({ documentId });
        const next = result?.entries?.[0] ?? updated;
        await syncPublishedPostToSearch(strapi, documentId);
        return next;
      }

      if (typeof documentsApi.publish === 'function') {
        const result = await documentsApi.publish({ documentId });
        const next = result?.entries?.[0] ?? updated;
        await syncPublishedPostToSearch(strapi, documentId);
        return next;
      }
    }

    return updated;
  },

  async deleteForAdmin(documentId: string) {
    let publishedId: number | null = null;
    try {
      const published = await strapi.documents(UID).findOne({
        documentId,
        status: 'published',
        fields: ['id'],
      });
      publishedId = published?.id ?? null;
    } catch {
      publishedId = null;
    }

    const deleted = await strapi.documents(UID).delete({ documentId });
    await removePostFromSearch(strapi, publishedId, documentId);
    return deleted;
  },

  async publishForAdmin(documentId: string) {
    const result = await strapi.documents(UID).publish({ documentId });
    await syncPublishedPostToSearch(strapi, documentId);
    return result?.entries?.[0] ?? null;
  },

  async unpublishForAdmin(documentId: string) {
    let publishedId: number | null = null;
    try {
      const published = await strapi.documents(UID).findOne({
        documentId,
        status: 'published',
        fields: ['id'],
      });
      publishedId = published?.id ?? null;
    } catch {
      publishedId = null;
    }

    const unpublished = await strapi.documents(UID).unpublish({ documentId });
    await removePostFromSearch(strapi, publishedId, documentId);
    return unpublished;
  },
}));
