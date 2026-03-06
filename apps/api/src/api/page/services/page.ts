import { factories } from '@strapi/strapi';

const UID = 'api::page.page';

function toPagination(query: any) {
  const page = Math.max(1, Number(query?.pagination?.page ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query?.pagination?.pageSize ?? 10) || 10));
  return { page, pageSize };
}

export default factories.createCoreService(UID, ({ strapi }) => ({
  async listForAdmin(query: any) {
    const { page, pageSize } = toPagination(query);
    const sort = query?.sort ?? 'updatedAt:desc';
    const keyword = String(query?.q ?? '').trim();
    const keywordFilters = keyword
      ? {
          $or: [
            { title: { $containsi: keyword } },
            { slug: { $containsi: keyword } },
            { type: { $containsi: keyword } },
            { content: { $containsi: keyword } },
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

  async findOneForAdmin(documentId: string, query: any) {
    return strapi.documents(UID).findOne({
      documentId,
      populate: query?.populate,
      fields: query?.fields,
      locale: query?.locale,
    });
  },

  async createForAdmin(payload: any) {
    return strapi.documents(UID).create({
      data: { ...(payload ?? {}) },
    });
  },

  async updateForAdmin(documentId: string, payload: any) {
    return strapi.documents(UID).update({
      documentId,
      data: { ...(payload ?? {}) },
    });
  },

  async deleteForAdmin(documentId: string) {
    return strapi.documents(UID).delete({ documentId });
  },
}));
