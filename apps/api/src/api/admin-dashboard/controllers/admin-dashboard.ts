declare const strapi: any;

export default {
  async overview(ctx) {
    const service = strapi.service('api::admin-dashboard.admin-dashboard') as any;
    const data = await service.overview();
    ctx.body = { data };
  },
};
