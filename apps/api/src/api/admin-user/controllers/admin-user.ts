declare const strapi: any;

export default {
  async list(ctx) {
    const page = Math.max(1, Number(ctx.query?.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(ctx.query?.pageSize ?? 10) || 10));
    const q = String(ctx.query?.q ?? '').trim();

    const service = strapi.service('api::admin-user.admin-user') as any;
    ctx.body = await service.list(page, pageSize, q);
  },

  async findOne(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isFinite(id)) {
      return ctx.badRequest('Invalid user id');
    }

    const service = strapi.service('api::admin-user.admin-user') as any;
    const user = await service.findOne(id);

    if (!user) {
      return ctx.notFound('User not found');
    }

    ctx.body = { data: user };
  },

  async listRoles(ctx) {
    const service = strapi.service('api::admin-user.admin-user') as any;
    const roles = await service.listRoles();
    ctx.body = { data: roles };
  },

  async create(ctx) {
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

  async update(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isFinite(id)) {
      return ctx.badRequest('Invalid user id');
    }

    const service = strapi.service('api::admin-user.admin-user') as any;
    const user = await service.update(id, ctx.request.body?.data ?? {});
    ctx.body = { data: user };
  },

  async remove(ctx) {
    const id = Number(ctx.params?.id);
    if (!Number.isFinite(id)) {
      return ctx.badRequest('Invalid user id');
    }

    const service = strapi.service('api::admin-user.admin-user') as any;
    const data = await service.remove(id);
    ctx.body = { data };
  },
};
