export default {
  routes: [
    {
      method: 'POST',
      path: '/tags/user-create',
      handler: 'tag.userCreate',
      config: {
        middlewares: ['plugin::users-permissions.rateLimit'],
      },
    },
  ],
};
