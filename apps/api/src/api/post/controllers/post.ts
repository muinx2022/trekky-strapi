import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::post.post', ({ strapi }) => ({
  async find(ctx) {
    const isAuthenticated = !!ctx.state?.user?.id;
    if (!isAuthenticated) {
      ctx.query = { ...ctx.query, status: 'published' };
    }
    const { data, meta } = await super.find(ctx);
    ctx.body = { data, meta };
  },

  async findOne(ctx) {
    ctx.query = { ...ctx.query, status: 'published' };
    try {
      const result = await super.findOne(ctx);
      if (!result || !result.data) {
        return ctx.notFound('Post not found');
      }
      ctx.body = { data: result.data, meta: result.meta };
    } catch (error) {
      console.error('[post.findOne] error:', error);
      return ctx.notFound('Post not found');
    }
  },

  async userCreate(ctx) {
    const userId = ctx.state?.user?.id;
    if (!userId) {
      return ctx.unauthorized('User not authenticated');
    }

    const { title, slug, content, categories } = ctx.request.body?.data || {};
    
    if (!title || !content) {
      return ctx.badRequest('Title and content are required');
    }

    try {
      const post = await strapi.documents('api::post.post').create({
        data: {
          title,
          slug,
          content,
          author: userId,
          categories: categories || [],
        },
        status: 'draft',
      });

      ctx.body = { data: post };
    } catch (error) {
      console.error('[post.userCreate] error:', error);
      return ctx.badRequest('Failed to create post');
    }
  },

  async userUpdate(ctx) {
    const userId = ctx.state?.user?.id;
    const documentId = ctx.params.documentId;

    if (!userId) {
      return ctx.unauthorized('User not authenticated');
    }

    if (!documentId) {
      return ctx.badRequest('Document ID is required');
    }

    try {
      const existing = await strapi.documents('api::post.post').findOne({
        documentId,
        populate: ['author'],
      });

      if (!existing || existing.author?.id !== userId) {
        return ctx.forbidden('You can only update your own posts');
      }

      const { title, content, categories } = ctx.request.body?.data || {};

      const updated = await strapi.documents('api::post.post').update({
        documentId,
        data: {
          ...(title && { title }),
          ...(content && { content }),
          ...(categories && { categories }),
        },
      });

      ctx.body = { data: updated };
    } catch (error) {
      console.error('[post.userUpdate] error:', error);
      return ctx.badRequest('Failed to update post');
    }
  },

  async myPosts(ctx) {
    const userId = ctx.state?.user?.id;
    if (!userId) {
      return ctx.unauthorized('User not authenticated');
    }

    const page = Math.max(1, parseInt(ctx.query.page as string || '1', 10));
    const pageSize = Math.max(1, Math.min(100, parseInt(ctx.query.pageSize as string || '10', 10)));
    const status = ctx.query.status === 'published' ? 'published' : 'draft';

    try {
      const [posts, total] = await Promise.all([
        strapi.documents('api::post.post').findMany({
          filters: {
            author: {
              id: userId,
            },
          },
          status,
          sort: 'updatedAt:desc',
          populate: ['categories'],
          pagination: { page, pageSize },
        }),
        strapi.documents('api::post.post').count({
          filters: {
            author: {
              id: userId,
            },
          },
          status,
        }),
      ]);

      ctx.body = {
        data: posts || [],
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.max(1, Math.ceil((total || 0) / pageSize)),
            total: total || 0,
          },
        },
      };
    } catch (error) {
      console.error('[post.myPosts] error:', error);
      ctx.body = {
        data: [],
        meta: {
          pagination: {
            page: 1,
            pageSize: 10,
            pageCount: 1,
            total: 0,
          },
        },
      };
    }
  },

  async userPublish(ctx) {
    const userId = ctx.state?.user?.id;
    const documentId = String(ctx.params?.documentId ?? '').trim();

    if (!userId) {
      return ctx.unauthorized('User not authenticated');
    }
    if (!documentId) {
      return ctx.badRequest('Document ID is required');
    }

    try {
      const existing = await strapi.documents('api::post.post').findOne({
        documentId,
        populate: ['author'],
      });

      if (!existing || existing.author?.id !== userId) {
        return ctx.forbidden('You can only publish your own posts');
      }

      const documentsApi = strapi.documents('api::post.post') as any;
      if (typeof documentsApi.publish === 'function') {
        const result = await documentsApi.publish({ documentId });
        ctx.body = { data: result?.entries?.[0] ?? null };
        return;
      }

      if (!existing.id) {
        return ctx.badRequest('Post not found');
      }

      await strapi.entityService.update('api::post.post', existing.id, {
        data: { publishedAt: new Date().toISOString() },
      });

      const updated = await strapi.documents('api::post.post').findOne({
        documentId,
        status: 'published',
      });

      ctx.body = { data: updated ?? null };
    } catch (error) {
      console.error('[post.userPublish] error:', error);
      return ctx.badRequest('Failed to publish post');
    }
  },

  async userUnpublish(ctx) {
    const userId = ctx.state?.user?.id;
    const documentId = String(ctx.params?.documentId ?? '').trim();

    if (!userId) {
      return ctx.unauthorized('User not authenticated');
    }
    if (!documentId) {
      return ctx.badRequest('Document ID is required');
    }

    try {
      const existing = await strapi.documents('api::post.post').findOne({
        documentId,
        populate: ['author'],
      });

      if (!existing || existing.author?.id !== userId) {
        return ctx.forbidden('You can only unpublish your own posts');
      }

      const documentsApi = strapi.documents('api::post.post') as any;
      if (typeof documentsApi.unpublish === 'function') {
        const result = await documentsApi.unpublish({ documentId });
        ctx.body = { data: result ?? null };
        return;
      }

      if (!existing.id) {
        return ctx.badRequest('Post not found');
      }

      await strapi.entityService.update('api::post.post', existing.id, {
        data: { publishedAt: null },
      });

      const updated = await strapi.documents('api::post.post').findOne({
        documentId,
        status: 'draft',
      });

      ctx.body = { data: updated ?? null };
    } catch (error) {
      console.error('[post.userUnpublish] error:', error);
      return ctx.badRequest('Failed to unpublish post');
    }
  },
}));
