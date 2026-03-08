import { factories } from '@strapi/strapi';

type JwtPayload = {
  id?: number;
};

async function resolveAuthUser(ctx: any, strapi: any) {
  if (ctx.state?.user?.id) return ctx.state.user;
  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const payload = (await jwtService.getToken(ctx)) as JwtPayload;
    if (!payload?.id) return null;
    const userService = strapi.plugin('users-permissions').service('user');
    return (await userService.fetchAuthenticatedUser(payload.id)) ?? null;
  } catch {
    return null;
  }
}

export default factories.createCoreController('api::report.report', ({ strapi }) => ({
  async mine(ctx) {
    const user = await resolveAuthUser(ctx, strapi);
    if (!user) return ctx.send({ data: { reported: false } });

    const { targetType, targetDocumentId } = ctx.query as Record<string, string>;
    if (!targetType || !targetDocumentId) return ctx.badRequest('Missing required fields.');

    const existing = await strapi.db.query('api::report.report').findMany({
      where: { reporter: user.id, targetType, targetDocumentId },
      limit: 1,
    });

    return ctx.send({ data: { reported: existing.length > 0 } });
  },

  async submit(ctx) {
    const user = await resolveAuthUser(ctx, strapi);

    if (!user) {
      return ctx.unauthorized('You must be logged in to report.');
    }

    const { targetType, targetDocumentId, reason } = ctx.request.body ?? {};

    if (!targetType || !targetDocumentId) {
      return ctx.badRequest('Missing required fields.');
    }

    const existing = await strapi.db.query('api::report.report').findMany({
      where: { reporter: user.id, targetType, targetDocumentId },
      limit: 1,
    });
    if (existing.length > 0) {
      return ctx.send({ data: { message: 'Already reported', alreadyReported: true } });
    }

    await strapi.db.query('api::report.report').create({
      data: {
        targetType,
        targetDocumentId,
        reason: reason ?? null,
        status: 'pending',
        reporter: user.id,
      },
    });

    return ctx.send({ data: { message: 'Report submitted' } });
  },
}));
