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

    { method: 'GET', path: '/management/pages', handler: 'management.listPages', config: adminOnly },
    { method: 'GET', path: '/management/pages/:documentId', handler: 'management.findPage', config: adminOnly },
    { method: 'POST', path: '/management/pages', handler: 'management.createPage', config: adminOnly },
    { method: 'PUT', path: '/management/pages/:documentId', handler: 'management.updatePage', config: adminOnly },
    { method: 'DELETE', path: '/management/pages/:documentId', handler: 'management.deletePage', config: adminOnly },

    { method: 'GET', path: '/management/categories', handler: 'management.listCategories', config: adminOnly },
    { method: 'GET', path: '/management/categories/:documentId', handler: 'management.findCategory', config: adminOnly },
    { method: 'POST', path: '/management/categories', handler: 'management.createCategory', config: adminOnly },
    { method: 'PUT', path: '/management/categories/:documentId', handler: 'management.updateCategory', config: adminOnly },
    { method: 'DELETE', path: '/management/categories/:documentId', handler: 'management.deleteCategory', config: adminOnly },
    { method: 'POST', path: '/management/categories/:documentId/publish', handler: 'management.publishCategory', config: adminOnly },
    { method: 'POST', path: '/management/categories/:documentId/unpublish', handler: 'management.unpublishCategory', config: adminOnly },
    { method: 'POST', path: '/management/categories/reorder', handler: 'management.reorderCategories', config: adminOnly },

    { method: 'GET', path: '/management/tags', handler: 'management.listTags', config: adminOnly },
    { method: 'GET', path: '/management/tags/:documentId', handler: 'management.findTag', config: adminOnly },
    { method: 'POST', path: '/management/tags', handler: 'management.createTag', config: adminOnly },
    { method: 'PUT', path: '/management/tags/:documentId', handler: 'management.updateTag', config: adminOnly },
    { method: 'DELETE', path: '/management/tags/:documentId', handler: 'management.deleteTag', config: adminOnly },
    { method: 'POST', path: '/management/tags/:documentId/publish', handler: 'management.publishTag', config: adminOnly },
    { method: 'POST', path: '/management/tags/:documentId/unpublish', handler: 'management.unpublishTag', config: adminOnly },
    { method: 'POST', path: '/management/tags/:sourceDocumentId/merge/:targetDocumentId', handler: 'management.mergeTags', config: adminOnly },

    { method: 'GET', path: '/management/comments', handler: 'management.listComments', config: adminOnly },
    { method: 'GET', path: '/management/comments/:documentId', handler: 'management.findComment', config: adminOnly },
    { method: 'POST', path: '/management/comments', handler: 'management.createComment', config: adminOnly },
    { method: 'PUT', path: '/management/comments/:documentId', handler: 'management.updateComment', config: adminOnly },
    { method: 'DELETE', path: '/management/comments/:documentId', handler: 'management.deleteComment', config: adminOnly },
    { method: 'POST', path: '/management/comments/:documentId/publish', handler: 'management.publishComment', config: adminOnly },
    { method: 'POST', path: '/management/comments/:documentId/unpublish', handler: 'management.unpublishComment', config: adminOnly },

    { method: 'GET', path: '/management/users', handler: 'management.listUsers', config: adminOnly },
    { method: 'POST', path: '/management/users/seed', handler: 'management.seedUsers', config: adminOnly },
    { method: 'POST', path: '/management/users/seed/batch-delete', handler: 'management.batchDeleteSeedUsers', config: adminOnly },
    { method: 'GET', path: '/management/users/:id', handler: 'management.findUser', config: adminOnly },
    { method: 'POST', path: '/management/users', handler: 'management.createUser', config: adminOnly },
    { method: 'PUT', path: '/management/users/:id', handler: 'management.updateUser', config: adminOnly },
    { method: 'DELETE', path: '/management/users/:id', handler: 'management.deleteUser', config: adminOnly },
    { method: 'GET', path: '/management/roles', handler: 'management.listRoles', config: adminOnly },

    { method: 'GET', path: '/management/settings/ai-automation', handler: 'management.getAiAutomationSettings', config: adminOnly },
    { method: 'PUT', path: '/management/settings/ai-automation', handler: 'management.updateAiAutomationSettings', config: adminOnly },
    { method: 'POST', path: '/management/settings/ai-automation/check-provider', handler: 'management.checkAiProviderConnection', config: adminOnly },
    { method: 'POST', path: '/management/settings/ai-automation/test-content', handler: 'management.testAiContent', config: adminOnly },
    { method: 'POST', path: '/management/settings/ai-automation/test-comment', handler: 'management.testAiComment', config: adminOnly },
    { method: 'POST', path: '/management/cron/content/run', handler: 'management.runAiContentCron', config: adminOnly },
    { method: 'POST', path: '/management/cron/comments/run', handler: 'management.runAiCommentCron', config: adminOnly },
    { method: 'POST', path: '/management/cron/auto-engage', handler: 'management.triggerAutoEngage', config: adminOnly },

    { method: 'GET', path: '/management/reports', handler: 'management.listReports', config: adminOnly },
    { method: 'PUT', path: '/management/reports/:id/status', handler: 'management.updateReportStatus', config: adminOnly },
    { method: 'DELETE', path: '/management/reports/:id', handler: 'management.deleteReport', config: adminOnly },
  ],
};
