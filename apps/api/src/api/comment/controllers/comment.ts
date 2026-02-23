import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::comment.comment', ({ strapi }) => ({
  async create(ctx) {
    const service = strapi.service('api::comment.comment') as any;
    try {
      const data = await service.createPublic(ctx.request.body?.data);
      ctx.body = { data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create comment';
      if (
        message === 'targetType and targetDocumentId are required' ||
        message === 'Parent comment not found' ||
        message === 'Parent comment must belong to the same target'
      ) {
        return ctx.badRequest(message);
      }
      throw error;
    }
  },

  async find(ctx) {
    const service = strapi.service('api::comment.comment') as any;
    ctx.body = await service.listPublic(ctx.query);
  },

  async findOne(ctx) {
    const service = strapi.service('api::comment.comment') as any;
    const documentId = String(ctx.params?.documentId ?? '').trim();

    if (!documentId) {
      return ctx.badRequest('documentId is required');
    }

    const data = await service.findOnePublic(documentId, ctx.query);
    if (!data) {
      return ctx.notFound('Comment not found');
    }

    ctx.body = { data };
  },

  async update(ctx) {
    const service = strapi.service('api::comment.comment') as any;
    const documentId = String(ctx.params?.documentId ?? '').trim();

    if (!documentId) {
      return ctx.badRequest('documentId is required');
    }

    const data = await service.updatePublic(documentId, ctx.request.body?.data);
    ctx.body = { data };
  },

  async delete(ctx) {
    const service = strapi.service('api::comment.comment') as any;
    const documentId = String(ctx.params?.documentId ?? '').trim();

    if (!documentId) {
      return ctx.badRequest('documentId is required');
    }

    await service.deletePublic(documentId);
    ctx.body = { data: { documentId } };
  },

  async publish(ctx) {
    ctx.body = { data: null, message: 'Draft/publish is disabled for comments.' };
  },

  async unpublish(ctx) {
    ctx.body = { data: null, message: 'Draft/publish is disabled for comments.' };
  },
}));
