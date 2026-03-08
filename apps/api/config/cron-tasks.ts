export default {
  aiAutomationHeartbeat: {
    task: async ({ strapi }) => {
      const { runDueAiAutomation } = await import('../src/automation/ai-automation');
      await runDueAiAutomation(strapi);
    },
    options: {
      rule: '* * * * *',
      tz: 'Asia/Ho_Chi_Minh',
    },
  },
};
