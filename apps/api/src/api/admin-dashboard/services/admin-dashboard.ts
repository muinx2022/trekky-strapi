declare const strapi: any;

const POST_UID = 'api::post.post';
const CATEGORY_UID = 'api::category.category';
const COMMENT_UID = 'api::comment.comment';

type AnyObject = Record<string, any>;

function summarizePost(item: AnyObject) {
  return {
    id: item.id,
    documentId: item.documentId,
    title: item.title,
    slug: item.slug,
    updatedAt: item.updatedAt,
  };
}

function summarizeCategory(item: AnyObject) {
  return {
    id: item.id,
    documentId: item.documentId,
    name: item.name,
    slug: item.slug,
    updatedAt: item.updatedAt,
  };
}

function summarizeComment(item: AnyObject) {
  return {
    id: item.id,
    documentId: item.documentId,
    authorName: item.authorName,
    content: item.content,
    targetType: item.targetType,
    targetDocumentId: item.targetDocumentId,
    updatedAt: item.updatedAt,
  };
}

export default {
  async overview() {
    const [postTotal, categoryTotal, commentTotal, recentPosts, recentCategories, recentComments] = await Promise.all([
      strapi.entityService.count(POST_UID, { publicationState: 'preview' }),
      strapi.entityService.count(CATEGORY_UID, { publicationState: 'preview' }),
      strapi.entityService.count(COMMENT_UID, { publicationState: 'preview' }),
      strapi.entityService.findMany(POST_UID, {
        fields: ['id', 'documentId', 'title', 'slug', 'updatedAt'],
        sort: { updatedAt: 'desc' },
        publicationState: 'preview',
        limit: 5,
      }),
      strapi.entityService.findMany(CATEGORY_UID, {
        fields: ['id', 'documentId', 'name', 'slug', 'updatedAt'],
        sort: { updatedAt: 'desc' },
        publicationState: 'preview',
        limit: 5,
      }),
      strapi.entityService.findMany(COMMENT_UID, {
        fields: ['id', 'documentId', 'authorName', 'content', 'targetType', 'targetDocumentId', 'updatedAt'],
        sort: { updatedAt: 'desc' },
        publicationState: 'preview',
        limit: 5,
      }),
    ]);

    return {
      totals: {
        posts: Number(postTotal ?? 0),
        categories: Number(categoryTotal ?? 0),
        comments: Number(commentTotal ?? 0),
      },
      recent: {
        posts: (recentPosts as AnyObject[]).map(summarizePost),
        categories: (recentCategories as AnyObject[]).map(summarizeCategory),
        comments: (recentComments as AnyObject[]).map(summarizeComment),
      },
    };
  },
};
