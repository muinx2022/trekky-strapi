export default {
  routes: [
    {
      method: 'GET',
      path: '/reports/mine',
      handler: 'api::report.report.mine',
      config: { auth: false, policies: [] },
    },
    {
      method: 'POST',
      path: '/reports/submit',
      handler: 'api::report.report.submit',
      config: { auth: false, policies: [] },
    },
  ],
};
