declare const strapi: any;

function readDocumentId(ctx: any) {
  const documentId = String(ctx.params?.documentId ?? '').trim();
  if (!documentId) {
    ctx.badRequest('documentId is required');
    return null;
  }
  return documentId;
}

function readUserId(ctx: any) {
  const id = Number(ctx.params?.id);
  if (!Number.isFinite(id)) {
    ctx.badRequest('Invalid user id');
    return null;
  }
  return id;
}

export default {
  async listPosts(ctx: any) {
    const service = strapi.service('api::post.post') as any;
    ctx.body = await service.listForAdmin(ctx.query);
  },

  async findPost(ctx: any) {
    const service = strapi.service('api::post.post') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.findOneForAdmin(documentId, ctx.query);
    if (!data) {
      return ctx.notFound('Post not found');
    }

    ctx.body = { data };
  },

  async createPost(ctx: any) {
    const service = strapi.service('api::post.post') as any;
    const data = await service.createForAdmin(ctx.request.body?.data);
    ctx.body = { data };
  },

  async updatePost(ctx: any) {
    const service = strapi.service('api::post.post') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.updateForAdmin(documentId, ctx.request.body?.data);
    ctx.body = { data };
  },

  async deletePost(ctx: any) {
    const service = strapi.service('api::post.post') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    await service.deleteForAdmin(documentId);
    ctx.body = { data: { documentId } };
  },

  async publishPost(ctx: any) {
    const service = strapi.service('api::post.post') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.publishForAdmin(documentId);
    ctx.body = { data };
  },

  async unpublishPost(ctx: any) {
    const service = strapi.service('api::post.post') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.unpublishForAdmin(documentId);
    ctx.body = { data };
  },

  async listCategories(ctx: any) {
    const service = strapi.service('api::category.category') as any;
    ctx.body = await service.listForAdmin(ctx.query);
  },

  async findCategory(ctx: any) {
    const service = strapi.service('api::category.category') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.findOneForAdmin(documentId, ctx.query);
    if (!data) {
      return ctx.notFound('Category not found');
    }

    ctx.body = { data };
  },

  async createCategory(ctx: any) {
    const service = strapi.service('api::category.category') as any;
    const data = await service.createForAdmin(ctx.request.body?.data);
    ctx.body = { data };
  },

  async updateCategory(ctx: any) {
    const service = strapi.service('api::category.category') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.updateForAdmin(documentId, ctx.request.body?.data);
    ctx.body = { data };
  },

  async deleteCategory(ctx: any) {
    const service = strapi.service('api::category.category') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    await service.deleteForAdmin(documentId);
    ctx.body = { data: { documentId } };
  },

  async publishCategory(ctx: any) {
    const service = strapi.service('api::category.category') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.publishForAdmin(documentId);
    ctx.body = { data };
  },

  async unpublishCategory(ctx: any) {
    const service = strapi.service('api::category.category') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.unpublishForAdmin(documentId);
    ctx.body = { data };
  },

  async reorderCategories(ctx: any) {
    const service = strapi.service('api::category.category') as any;
    const rawDraggedId = ctx.request.body?.draggedId;
    const rawTargetId = ctx.request.body?.targetId;
    const draggedId = Number(rawDraggedId);
    const hasTargetId = !(rawTargetId === null || rawTargetId === undefined || rawTargetId === '');
    const targetId = hasTargetId ? Number(rawTargetId) : null;
    const position = String(ctx.request.body?.position ?? '');

    if (!Number.isFinite(draggedId)) {
      return ctx.badRequest('draggedId is required');
    }

    if (!['child', 'after', 'root'].includes(position)) {
      return ctx.badRequest("position must be 'child', 'after' or 'root'");
    }

    if (position !== 'root' && !Number.isFinite(targetId as number)) {
      return ctx.badRequest('targetId is required for child/after');
    }

    if (Number.isFinite(targetId as number) && draggedId === targetId) {
      return ctx.badRequest('draggedId cannot equal targetId');
    }

    try {
      ctx.body = await service.reorderForAdmin(
        draggedId,
        Number.isFinite(targetId as number) ? (targetId as number) : null,
        position as 'child' | 'after' | 'root',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reorder category';
      if (message === 'Category not found') {
        return ctx.notFound(message);
      }
      throw error;
    }
  },

  async listComments(ctx: any) {
    const service = strapi.service('api::comment.comment') as any;
    ctx.body = await service.listForAdmin(ctx.query);
  },

  async findComment(ctx: any) {
    const service = strapi.service('api::comment.comment') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.findOneForAdmin(documentId, ctx.query);
    if (!data) {
      return ctx.notFound('Comment not found');
    }

    ctx.body = { data };
  },

  async createComment(ctx: any) {
    const service = strapi.service('api::comment.comment') as any;
    const data = await service.createForAdmin(ctx.request.body?.data);
    ctx.body = { data };
  },

  async updateComment(ctx: any) {
    const service = strapi.service('api::comment.comment') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.updateForAdmin(documentId, ctx.request.body?.data);
    ctx.body = { data };
  },

  async deleteComment(ctx: any) {
    const service = strapi.service('api::comment.comment') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    await service.deleteForAdmin(documentId);
    ctx.body = { data: { documentId } };
  },

  async publishComment(ctx: any) {
    const service = strapi.service('api::comment.comment') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.publishForAdmin(documentId);
    ctx.body = { data };
  },

  async unpublishComment(ctx: any) {
    const service = strapi.service('api::comment.comment') as any;
    const documentId = readDocumentId(ctx);
    if (!documentId) return;

    const data = await service.unpublishForAdmin(documentId);
    ctx.body = { data };
  },

  async listUsers(ctx: any) {
    const page = Math.max(1, Number(ctx.query?.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(ctx.query?.pageSize ?? 10) || 10));
    const q = String(ctx.query?.q ?? '').trim();

    const service = strapi.service('api::admin-user.admin-user') as any;
    ctx.body = await service.list(page, pageSize, q);
  },

  async findUser(ctx: any) {
    const id = readUserId(ctx);
    if (!id) return;

    const service = strapi.service('api::admin-user.admin-user') as any;
    const user = await service.findOne(id);

    if (!user) {
      return ctx.notFound('User not found');
    }

    ctx.body = { data: user };
  },

  async listRoles(ctx: any) {
    const service = strapi.service('api::admin-user.admin-user') as any;
    const roles = await service.listRoles();
    ctx.body = { data: roles };
  },

  async createUser(ctx: any) {
    const service = strapi.service('api::admin-user.admin-user') as any;

    try {
      const user = await service.create(ctx.request.body?.data ?? {});
      ctx.body = { data: user };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create user';
      if (message === 'username, email and password are required') {
        return ctx.badRequest(message);
      }
      throw error;
    }
  },

  async updateUser(ctx: any) {
    const id = readUserId(ctx);
    if (!id) return;

    const service = strapi.service('api::admin-user.admin-user') as any;
    const user = await service.update(id, ctx.request.body?.data ?? {});
    ctx.body = { data: user };
  },

  async deleteUser(ctx: any) {
    const id = readUserId(ctx);
    if (!id) return;

    const service = strapi.service('api::admin-user.admin-user') as any;
    const data = await service.remove(id);
    ctx.body = { data };
  },

  async dashboard(ctx: any) {
    const service = strapi.service('api::admin-dashboard.admin-dashboard') as any;
    const data = await service.overview();
    ctx.body = { data };
  },
};
