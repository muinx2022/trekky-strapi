import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::tag.tag', ({ strapi }) => ({
  async userCreate(ctx) {
    const body = ctx.request.body as { name?: string };
    const name = String(body?.name ?? '').trim();
    if (!name) {
      return ctx.badRequest('Tag name is required');
    }

    // Return existing published tag if name already taken (case-insensitive)
    const existing = await (strapi.documents('api::tag.tag') as any).findFirst({
      filters: { name: { $eqi: name } },
      status: 'published',
    });
    if (existing) {
      return ctx.send({ data: { documentId: existing.documentId, name: existing.name, slug: existing.slug } });
    }

    // Also check drafts (tag may have been created but not published yet)
    const existingDraft = await (strapi.documents('api::tag.tag') as any).findFirst({
      filters: { name: { $eqi: name } },
      status: 'draft',
    });
    if (existingDraft) {
      // Publish and return
      try {
        await (strapi.documents('api::tag.tag') as any).publish({ documentId: existingDraft.documentId });
      } catch (e) {
        console.warn('[tag.userCreate] Failed to publish existing draft tag:', e);
      }
      return ctx.send({ data: { documentId: existingDraft.documentId, name: existingDraft.name, slug: existingDraft.slug } });
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

    // Publish immediately so the tag is visible via the public API.
    try {
      const docsApi = strapi.documents('api::tag.tag') as any;
      if (typeof docsApi.publish === 'function') {
        await docsApi.publish({ documentId: tag.documentId });
      }
    } catch (e) {
      console.warn('[tag.userCreate] Failed to publish tag:', e);
    }

    return ctx.send({ data: { documentId: tag.documentId, name: tag.name, slug: tag.slug } });
  },
}));
