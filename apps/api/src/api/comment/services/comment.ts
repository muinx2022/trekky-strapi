import { factories } from '@strapi/strapi';

const UID = 'api::comment.comment';
const POST_UID = 'api::post.post';

function toPagination(query: any) {
  const page = Math.max(1, Number(query?.pagination?.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pagination?.pageSize ?? 10) || 10));
  return { page, pageSize };
}

async function ensureValidParent(
  strapi: any,
  parentDocumentId: string | null,
  targetType: string,
  targetDocumentId: string,
  currentDocumentId?: string,
) {
  if (!parentDocumentId) {
    return null;
  }

  const parent = await strapi.documents(UID).findOne({
    documentId: parentDocumentId,
    fields: ['documentId', 'targetType', 'targetDocumentId'],
  });

  if (!parent) {
    throw new Error('Parent comment not found');
  }

  if (currentDocumentId && parent.documentId === currentDocumentId) {
    throw new Error('Comment cannot reply to itself');
  }

  if (parent.targetType !== targetType || parent.targetDocumentId !== targetDocumentId) {
    throw new Error('Parent comment must belong to the same target');
  }

  return parent.documentId as string;
}

async function normalizeCommentPayload(strapi: any, payload: any, currentDocumentId?: string) {
  const data = { ...(payload ?? {}) };
  const targetType = String(data.targetType ?? '').trim();
  const targetDocumentId = String(data.targetDocumentId ?? '').trim();

  if (!targetType || !targetDocumentId) {
    throw new Error('targetType and targetDocumentId are required');
  }

  const rawParent = String(data.parent ?? data.parentDocumentId ?? '').trim();
  data.parent = await ensureValidParent(
    strapi,
    rawParent || null,
    targetType,
    targetDocumentId,
    currentDocumentId,
  );
  delete data.parentDocumentId;

  return data;
}

export default factories.createCoreService(UID, ({ strapi }) => ({
  async listPublic(query: any) {
    const { page, pageSize } = toPagination(query);
    const sort = query?.sort ?? 'createdAt:asc';
    const filters = query?.filters;

    const [data, total] = await Promise.all([
      strapi.documents(UID).findMany({
        sort,
        filters,
        populate: query?.populate ?? {
          parent: {
            fields: ['documentId', 'authorName', 'targetType', 'targetDocumentId'],
          },
        },
        pagination: { page, pageSize },
      }),
      strapi.documents(UID).count({ filters }),
    ]);

    return {
      data,
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

  async listForAdmin(query: any) {
    const { page, pageSize } = toPagination(query);
    const sort = query?.sort ?? 'updatedAt:desc';
    const keyword = String(query?.q ?? '').trim();
    const keywordFilters = keyword
      ? {
          $or: [
            { authorName: { $containsi: keyword } },
            { authorEmail: { $containsi: keyword } },
            { content: { $containsi: keyword } },
            { targetDocumentId: { $containsi: keyword } },
          ],
        }
      : undefined;

    const filters = query?.filters
      ? keywordFilters
        ? { $and: [query.filters, keywordFilters] }
        : query.filters
      : keywordFilters;

    const [data, total] = await Promise.all([
      strapi.documents(UID).findMany({
        sort,
        filters,
        populate: {
          parent: {
            fields: ['documentId', 'authorName', 'targetType', 'targetDocumentId'],
          },
        },
        pagination: { page, pageSize },
      }),
      strapi.documents(UID).count({ filters }),
    ]);

    const postIds = Array.from(
      new Set(
        (data as any[])
          .filter((item) => item.targetType === 'post' && item.targetDocumentId)
          .map((item) => item.targetDocumentId),
      ),
    );

    const postMap = new Map<string, string>();
    if (postIds.length > 0) {
      const posts = (await strapi.documents(POST_UID).findMany({
        filters: { documentId: { $in: postIds } },
        fields: ['title'],
        pagination: { page: 1, pageSize: 1000 },
      })) as Array<{ documentId: string; title?: string }>;

      for (const post of posts) {
        postMap.set(post.documentId, post.title ?? post.documentId);
      }
    }

    const enriched = (data as any[]).map((item) => ({
      ...item,
      targetTitle:
        item.targetType === 'post'
          ? postMap.get(item.targetDocumentId) ?? item.targetDocumentId
          : item.targetDocumentId,
    }));

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
      populate: query?.populate ?? {
        parent: {
          fields: ['documentId', 'authorName', 'targetType', 'targetDocumentId'],
        },
      },
      fields: query?.fields,
      locale: query?.locale,
    });
  },

  async findOnePublic(documentId: string, query: any) {
    return strapi.documents(UID).findOne({
      documentId,
      populate: query?.populate ?? {
        parent: {
          fields: ['documentId', 'authorName', 'targetType', 'targetDocumentId'],
        },
      },
      fields: query?.fields,
      locale: query?.locale,
    });
  },

  async createPublic(payload: any) {
    const data = await normalizeCommentPayload(strapi, payload);
    return strapi.documents(UID).create({ data });
  },

  async createForAdmin(payload: any) {
    const data = await normalizeCommentPayload(strapi, payload);
    return strapi.documents(UID).create({ data });
  },

  async updatePublic(documentId: string, payload: any) {
    const data = await normalizeCommentPayload(strapi, payload, documentId);
    return strapi.documents(UID).update({ documentId, data });
  },

  async updateForAdmin(documentId: string, payload: any) {
    const data = await normalizeCommentPayload(strapi, payload, documentId);
    return strapi.documents(UID).update({ documentId, data });
  },

  async deletePublic(documentId: string) {
    return strapi.documents(UID).delete({ documentId });
  },

  async deleteForAdmin(documentId: string) {
    return strapi.documents(UID).delete({ documentId });
  },
}));
