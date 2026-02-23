const adminOnly = {
  auth: false,
  policies: ['global::is-admin-user'],
};

export default {
  routes: [
    { method: 'GET', path: '/management/dashboard', handler: 'management.dashboard', config: adminOnly },

    { method: 'GET', path: '/management/posts', handler: 'management.listPosts', config: adminOnly },
    { method: 'GET', path: '/management/posts/:documentId', handler: 'management.findPost', config: adminOnly },
    { method: 'POST', path: '/management/posts', handler: 'management.createPost', config: adminOnly },
    { method: 'PUT', path: '/management/posts/:documentId', handler: 'management.updatePost', config: adminOnly },
    { method: 'DELETE', path: '/management/posts/:documentId', handler: 'management.deletePost', config: adminOnly },
    { method: 'POST', path: '/management/posts/:documentId/publish', handler: 'management.publishPost', config: adminOnly },
    { method: 'POST', path: '/management/posts/:documentId/unpublish', handler: 'management.unpublishPost', config: adminOnly },

    { method: 'GET', path: '/management/categories', handler: 'management.listCategories', config: adminOnly },
    { method: 'GET', path: '/management/categories/:documentId', handler: 'management.findCategory', config: adminOnly },
    { method: 'POST', path: '/management/categories', handler: 'management.createCategory', config: adminOnly },
    { method: 'PUT', path: '/management/categories/:documentId', handler: 'management.updateCategory', config: adminOnly },
    { method: 'DELETE', path: '/management/categories/:documentId', handler: 'management.deleteCategory', config: adminOnly },
    { method: 'POST', path: '/management/categories/:documentId/publish', handler: 'management.publishCategory', config: adminOnly },
    { method: 'POST', path: '/management/categories/:documentId/unpublish', handler: 'management.unpublishCategory', config: adminOnly },
    { method: 'POST', path: '/management/categories/reorder', handler: 'management.reorderCategories', config: adminOnly },

    { method: 'GET', path: '/management/comments', handler: 'management.listComments', config: adminOnly },
    { method: 'GET', path: '/management/comments/:documentId', handler: 'management.findComment', config: adminOnly },
    { method: 'POST', path: '/management/comments', handler: 'management.createComment', config: adminOnly },
    { method: 'PUT', path: '/management/comments/:documentId', handler: 'management.updateComment', config: adminOnly },
    { method: 'DELETE', path: '/management/comments/:documentId', handler: 'management.deleteComment', config: adminOnly },
    { method: 'POST', path: '/management/comments/:documentId/publish', handler: 'management.publishComment', config: adminOnly },
    { method: 'POST', path: '/management/comments/:documentId/unpublish', handler: 'management.unpublishComment', config: adminOnly },

    { method: 'GET', path: '/management/users', handler: 'management.listUsers', config: adminOnly },
    { method: 'GET', path: '/management/users/:id', handler: 'management.findUser', config: adminOnly },
    { method: 'POST', path: '/management/users', handler: 'management.createUser', config: adminOnly },
    { method: 'PUT', path: '/management/users/:id', handler: 'management.updateUser', config: adminOnly },
    { method: 'DELETE', path: '/management/users/:id', handler: 'management.deleteUser', config: adminOnly },
    { method: 'GET', path: '/management/roles', handler: 'management.listRoles', config: adminOnly },
  ],
};
