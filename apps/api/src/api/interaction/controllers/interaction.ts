import { factories } from '@strapi/strapi';

type JwtPayload = {
  id?: number;
};

async function resolveAuthUser(ctx: any, strapi: any) {
  if (ctx.state?.user?.id) {
    return ctx.state.user;
  }

  try {
    const jwtService = strapi.plugin('users-permissions').service('jwt');
    const userService = strapi.plugin('users-permissions').service('user');
    const payload = (await jwtService.getToken(ctx)) as JwtPayload;
    if (!payload?.id) {
      return null;
    }

    const user = await userService.fetchAuthenticatedUser(payload.id);
    return user ?? null;
  } catch {
    return null;
  }
}

export default factories.createCoreController('api::interaction.interaction', ({ strapi }) => ({
  async mine(ctx) {
    const user = await resolveAuthUser(ctx, strapi);
    if (!user) {
      return ctx.send({ data: [] });
    }

    const { targetType, targetDocumentId } = ctx.query as Record<string, string>;

    // strapi.db.query where: plain scalar for a relation = filter by the FK value
    const where: Record<string, unknown> = { user: user.id };
    if (targetType) where.targetType = targetType;
    if (targetDocumentId) where.targetDocumentId = targetDocumentId;

    const interactions = await strapi.db.query('api::interaction.interaction').findMany({
      where,
      select: ['actionType', 'targetDocumentId'],
      limit: 200,
    });

    return ctx.send({ data: interactions });
  },

  async counts(ctx) {
    const { targetType } = ctx.query as Record<string, string>;
    const raw = (ctx.query as any).targetDocumentIds;
    const ids: string[] = Array.isArray(raw)
      ? (raw as string[]).filter(Boolean)
      : typeof raw === 'string' && raw
      ? [raw]
      : [];

    if (!targetType || ids.length === 0) {
      return ctx.send({ data: { likes: {}, follows: {} } });
    }

    const interactions = await strapi.db.query('api::interaction.interaction').findMany({
      where: {
        targetType,
        targetDocumentId: { $in: ids },
        actionType: { $in: ['like', 'follow'] },
      },
      select: ['actionType', 'targetDocumentId'],
      limit: 100000,
    });

    const likes: Record<string, number> = {};
    const follows: Record<string, number> = {};

    for (const i of interactions as Array<{ actionType: string; targetDocumentId: string }>) {
      if (i.actionType === 'like') {
        likes[i.targetDocumentId] = (likes[i.targetDocumentId] ?? 0) + 1;
      } else if (i.actionType === 'follow') {
        follows[i.targetDocumentId] = (follows[i.targetDocumentId] ?? 0) + 1;
      }
    }

    return ctx.send({ data: { likes, follows } });
  },

  async toggle(ctx) {
    const user = await resolveAuthUser(ctx, strapi);
    if (!user) {
      return ctx.unauthorized('You must be logged in to perform this action.');
    }

    const { actionType, targetType, targetDocumentId } = ctx.request.body;

    if (!actionType || !targetType || !targetDocumentId) {
      return ctx.badRequest('Missing required fields.');
    }

    const existing = await strapi.db.query('api::interaction.interaction').findMany({
      where: {
        user: user.id,
        actionType,
        targetType,
        targetDocumentId,
      },
      limit: 1,
    });

    if (existing.length > 0) {
      await strapi.db.query('api::interaction.interaction').delete({
        where: { id: existing[0].id },
      });
      return ctx.send({ data: { message: `Removed ${actionType}`, active: false } });
    }

    const created = await strapi.db.query('api::interaction.interaction').create({
      data: {
        actionType,
        targetType,
        targetDocumentId,
        user: user.id,
        publishedAt: new Date(),
      },
    });
    return ctx.send({ data: { message: `Added ${actionType}`, active: true, interaction: created } });
  },
}));
