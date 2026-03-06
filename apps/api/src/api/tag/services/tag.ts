import { factories } from '@strapi/strapi';

const UID = 'api::tag.tag';
const POST_UID = 'api::post.post';

function toStatus(status: unknown): 'draft' | 'published' | undefined {
  return status === 'draft' || status === 'published' ? status : undefined;
}

function toPagination(query: any) {
  const page = Math.max(1, Number(query?.pagination?.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pagination?.pageSize ?? 10) || 10));
  return { page, pageSize };
}

function normalizeAliases(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const dedup = new Map<string, string>();
  for (const item of source) {
    const text = String(item ?? '').trim();
    if (!text) {
      continue;
    }
    const key = text.toLowerCase();
    if (!dedup.has(key)) {
      dedup.set(key, text);
    }
  }
  return Array.from(dedup.values());
}

function normalizeTagPayload(payload: any) {
  const data = { ...(payload ?? {}) };
  if ('aliases' in data) {
    data.aliases = normalizeAliases(data.aliases);
  }
  return data;
}

async function findTagByDocumentId(strapi: any, documentId: string) {
  const [draftEntry, publishedEntry] = await Promise.all([
    strapi.documents(UID).findOne({
      documentId,
      populate: ['posts'],
      status: 'draft',
    }),
    strapi.documents(UID).findOne({
      documentId,
      populate: ['posts'],
      status: 'published',
    }),
  ]);

  return draftEntry ?? publishedEntry ?? null;
}

async function findDocumentPostIdsForTag(strapi: any, tagDocumentId: string) {
  const pageSize = 200;
  const postDocumentIds = new Set<string>();
  const postDocuments = strapi.documents(POST_UID) as any;

  for (const status of ['draft', 'published'] as const) {
    let page = 1;
    while (true) {
      const batch = (await postDocuments.findMany({
        fields: ['documentId'],
        filters: {
          tags: {
            documentId: { $eq: tagDocumentId },
          },
        },
        pagination: { page, pageSize },
        status,
      })) as Array<{ documentId?: string }>;

      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }

      for (const item of batch) {
        const documentId = String(item?.documentId ?? '').trim();
        if (documentId) {
          postDocumentIds.add(documentId);
        }
      }

      if (batch.length < pageSize) {
        break;
      }
      page += 1;
    }
  }

  return Array.from(postDocumentIds);
}

export default factories.createCoreService(UID, ({ strapi }) => ({
  async listForAdmin(query: any) {
    const { page, pageSize } = toPagination(query);
    const sort = query?.sort ?? 'updatedAt:desc';
    const status = toStatus(query?.status);
    const keyword = String(query?.q ?? '').trim();
    const keywordFilters = keyword
      ? {
          $or: [
            { name: { $containsi: keyword } },
            { slug: { $containsi: keyword } },
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
        populate: query?.populate,
        pagination: { page, pageSize },
        status,
      }),
      strapi.documents(UID).count({ status, filters }),
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
    const data = normalizeTagPayload(payload);
    return strapi.documents(UID).create({
      data,
      status: 'draft',
    });
  },

  async updateForAdmin(documentId: string, payload: any) {
    const data = normalizeTagPayload(payload);
    return strapi.documents(UID).update({
      documentId,
      data,
    });
  },

  async deleteForAdmin(documentId: string) {
    return strapi.documents(UID).delete({ documentId });
  },

  async publishForAdmin(documentId: string) {
    const documentsApi = strapi.documents(UID) as any;
    if (typeof documentsApi.publish === 'function') {
      const result = await documentsApi.publish({ documentId });
      return result?.entries?.[0] ?? null;
    }

    const rows = (await strapi.entityService.findMany(UID, {
      fields: ['id'],
      filters: { documentId: { $eq: documentId } },
      publicationState: 'preview',
      limit: 1,
    } as any)) as Array<{ id: number }>;
    const entityId = rows?.[0]?.id;
    if (!entityId) {
      throw new Error('Tag not found');
    }

    await strapi.entityService.update(UID, entityId, {
      data: { publishedAt: new Date().toISOString() },
    });

    return strapi.documents(UID).findOne({
      documentId,
      status: 'published',
    });
  },

  async unpublishForAdmin(documentId: string) {
    const documentsApi = strapi.documents(UID) as any;
    if (typeof documentsApi.unpublish === 'function') {
      return documentsApi.unpublish({ documentId });
    }

    const rows = (await strapi.entityService.findMany(UID, {
      fields: ['id'],
      filters: { documentId: { $eq: documentId } },
      publicationState: 'preview',
      limit: 1,
    } as any)) as Array<{ id: number }>;
    const entityId = rows?.[0]?.id;
    if (!entityId) {
      throw new Error('Tag not found');
    }

    await strapi.entityService.update(UID, entityId, {
      data: { publishedAt: null },
    });

    return strapi.documents(UID).findOne({
      documentId,
      status: 'draft',
    });
  },

  async mergeForAdmin(sourceDocumentId: string, targetDocumentId: string) {
    if (sourceDocumentId === targetDocumentId) {
      throw new Error('Cannot merge a tag into itself');
    }

    const sourceTag = await findTagByDocumentId(strapi, sourceDocumentId);
    const targetTag = await findTagByDocumentId(strapi, targetDocumentId);

    if (!sourceTag || !targetTag) {
      throw new Error('Tag not found');
    }

    const postDocumentIds = await findDocumentPostIdsForTag(strapi, sourceDocumentId);
    const postDocuments = strapi.documents(POST_UID) as any;

    for (const postDocumentId of postDocumentIds) {
      const postEntry =
        (await postDocuments.findOne({
          documentId: postDocumentId,
          populate: ['tags'],
          status: 'draft',
        })) ??
        (await postDocuments.findOne({
          documentId: postDocumentId,
          populate: ['tags'],
          status: 'published',
        }));

      if (!postEntry) {
        continue;
      }

      const nextTagIds = Array.from(
        new Set(
          (postEntry.tags ?? [])
            .map((tag: { documentId?: string }) => String(tag?.documentId ?? '').trim())
            .filter((tagId: string) => Boolean(tagId) && tagId !== sourceDocumentId)
            .concat(targetDocumentId),
        ),
      );

      await postDocuments.update({
        documentId: postDocumentId,
        data: { tags: nextTagIds },
      });
    }

    const mergedAliases = normalizeAliases([
      ...(Array.isArray(targetTag.aliases) ? targetTag.aliases : []),
      ...(Array.isArray(sourceTag.aliases) ? sourceTag.aliases : []),
      sourceTag.name,
    ]);

    const updatedTarget = await strapi.documents(UID).update({
      documentId: targetDocumentId,
      data: {
        aliases: mergedAliases,
      },
    });

    await strapi.documents(UID).delete({ documentId: sourceDocumentId });

    return {
      target: updatedTarget,
      mergedPostCount: postDocumentIds.length,
    };
  },
}));
