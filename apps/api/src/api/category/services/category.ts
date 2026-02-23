import { factories } from '@strapi/strapi';

const UID = 'api::category.category';

type CategoryDoc = {
  id: number;
  documentId: string;
  sortOrder?: number | null;
  parent?: { id: number; documentId: string } | null;
};

function toStatus(status: unknown): 'draft' | 'published' | undefined {
  return status === 'draft' || status === 'published' ? status : undefined;
}

function toPagination(query: any) {
  const page = Math.max(1, Number(query?.pagination?.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pagination?.pageSize ?? 10) || 10));
  return { page, pageSize };
}

function normalizeCategoryPayload(payload: any, currentDocumentId?: string) {
  const data = { ...(payload ?? {}) };
  if ("parent" in data) {
    const parentDocumentId =
      typeof data.parent === "string" ? data.parent.trim() : "";
    data.parent =
      parentDocumentId && parentDocumentId !== currentDocumentId
        ? parentDocumentId
        : null;
  }
  return data;
}

export default factories.createCoreService(UID, ({ strapi }) => ({
  async listForAdmin(query: any) {
    const { page, pageSize } = toPagination(query);
    const sort = query?.sort ?? 'sortOrder:asc';

    // Fetch all categories (both draft and published) without pagination first
    const [allDraftData, allPublishedData] = await Promise.all([
      strapi.documents(UID).findMany({
        sort,
        pagination: { page: 1, pageSize: 10000 },
        populate: query?.populate,
        status: 'draft',
      }),
      strapi.documents(UID).findMany({
        sort,
        pagination: { page: 1, pageSize: 10000 },
        populate: query?.populate,
        status: 'published',
      }),
    ]);

    console.log('[category.listForAdmin] draft count:', allDraftData?.length, 'published count:', allPublishedData?.length);

    const merged = new Map<string, any>();
    
    for (const item of allDraftData as any[]) {
      merged.set(item.documentId, { ...item, publishedAt: null });
    }
    
    for (const item of allPublishedData as any[]) {
      const existing = merged.get(item.documentId);
      if (existing) {
        merged.set(item.documentId, {
          ...existing,
          publishedAt: item.publishedAt,
        });
      } else {
        merged.set(item.documentId, item);
      }
    }

    const allData = Array.from(merged.values()).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const total = allData.length;
    
    console.log('[category.listForAdmin] merged total:', total, 'page:', page, 'pageSize:', pageSize);
    
    // Apply pagination after merging
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const data = allData.slice(start, end);

    console.log('[category.listForAdmin] returning:', data.length, 'items');

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
    const data = normalizeCategoryPayload(payload);
    return strapi.documents(UID).create({
      data,
      status: 'draft',
    });
  },

  async updateForAdmin(documentId: string, payload: any) {
    const data = normalizeCategoryPayload(payload, documentId);
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
      throw new Error('Category not found');
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
      throw new Error('Category not found');
    }

    await strapi.entityService.update(UID, entityId, {
      data: { publishedAt: null },
    });

    return strapi.documents(UID).findOne({
      documentId,
      status: 'draft',
    });
  },

  async reorderForAdmin(draggedId: number, targetId: number | null, position: 'child' | 'after' | 'root') {
    const categories = (await strapi.entityService.findMany(UID, {
      fields: ['id', 'documentId', 'sortOrder'],
      populate: { parent: { fields: ['id', 'documentId'] } },
      publicationState: 'preview',
      limit: 10000,
    } as any)) as CategoryDoc[];

    const dragged = categories.find((item) => item.id === draggedId);
    const target = Number.isFinite(targetId as number)
      ? categories.find((item) => item.id === targetId)
      : null;

    if (!dragged || (position !== 'root' && !target)) {
      throw new Error('Category not found');
    }

    if (position === 'root') {
      const siblings = categories
        .filter((item) => (item.parent?.id ?? null) === null && item.id !== dragged.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      const reordered = [...siblings, dragged];

      for (let index = 0; index < reordered.length; index += 1) {
        const category = reordered[index];
        const nextParentId = null;

        await strapi.entityService.update(UID, category.id, {
          data: {
            sortOrder: index,
            parent: nextParentId,
          },
        });
      }

      return { ok: true };
    }

    const targetParentId = position === 'child' ? target.id : target.parent?.id ?? null;

    const siblings = categories
      .filter((item) => (item.parent?.id ?? null) === targetParentId && item.id !== dragged.id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const reordered: CategoryDoc[] = [];
    for (const sibling of siblings) {
      reordered.push(sibling);
      if (position === 'after' && sibling.id === target.id) {
        reordered.push(dragged);
      }
    }

    if (position === 'child') {
      reordered.push(dragged);
    } else if (!reordered.find((item) => item.id === dragged.id)) {
      reordered.push(dragged);
    }

    for (let index = 0; index < reordered.length; index += 1) {
      const category = reordered[index];
      const nextParentId = category.id === dragged.id ? targetParentId : category.parent?.id ?? null;

      await strapi.entityService.update(UID, category.id, {
        data: {
          sortOrder: index,
          parent: nextParentId,
        },
      });
    }

    return { ok: true };
  },
}));
