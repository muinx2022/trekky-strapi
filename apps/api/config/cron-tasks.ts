export default {
  autoEngage: {
    task: async ({ strapi }) => {
      const { autoEngage } = await import('../src/cron/auto-engage');
      await autoEngage(strapi);
    },
    options: {
      rule: process.env.CRON_AUTO_ENGAGE_SCHEDULE ?? '0 */6 * * *',
      tz: 'Asia/Ho_Chi_Minh',
    },
  },
};
