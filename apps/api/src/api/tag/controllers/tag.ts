import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::tag.tag', ({ strapi }) => ({
  async userCreate(ctx) {
    const body = ctx.request.body as { name?: string };
    const name = String(body?.name ?? '').trim();
    if (!name) {
      return ctx.badRequest('Tag name is required');
    }

    const existing = await (strapi.documents('api::tag.tag') as any).findFirst({
      filters: { name: { $eqi: name } },
    });
    if (existing) {
      return ctx.send({ data: { documentId: existing.documentId, name: existing.name, slug: existing.slug } });
    }

    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || `tag-${Date.now()}`;

    const tag = await strapi.documents('api::tag.tag').create({ data: { name, slug } });

    return ctx.send({ data: { documentId: tag.documentId, name: tag.name, slug: tag.slug } });
  },
}));
