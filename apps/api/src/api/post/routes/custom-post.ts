export default {
  routes: [
    {
      method: 'POST',
      path: '/posts/user-create',
      handler: 'post.userCreate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/posts/:documentId/user-update',
      handler: 'post.userUpdate',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/posts/my-posts',
      handler: 'post.myPosts',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/posts/:documentId/user-publish',
      handler: 'post.userPublish',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/posts/by-username/:username',
      handler: 'post.byUsername',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/posts/:documentId/user-unpublish',
      handler: 'post.userUnpublish',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
