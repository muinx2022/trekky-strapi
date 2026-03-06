import type { Core } from '@strapi/strapi';

export default ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => {
  const provider = env('UPLOAD_PROVIDER', 'local'); // 'local' | 'r2' | 'cloudinary'

  const uploadConfig: Record<string, unknown> = {
    security: {
      allowedTypes: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/avif',
        'video/mp4',
        'video/webm',
        'application/pdf',
        'text/plain',
      ],
      deniedTypes: ['text/html', 'application/javascript', 'image/svg+xml'],
    },
    sizeLimit: env.int('UPLOAD_SIZE_LIMIT', 10 * 1024 * 1024),
  };

  if (provider === 'r2') {
    uploadConfig.provider = '@strapi/provider-upload-aws-s3';
    uploadConfig.providerOptions = {
      accessKeyId: env('R2_ACCESS_KEY_ID'),
      secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
      region: 'auto',
      endpoint: env('R2_ENDPOINT'),
      params: { Bucket: env('R2_BUCKET') },
      s3ForcePathStyle: true,
      baseUrl: env('R2_PUBLIC_URL'),
    };
    uploadConfig.actionOptions = {
      upload: { ACL: undefined },
      uploadStream: { ACL: undefined },
      delete: {},
    };
  } else if (provider === 'cloudinary') {
    uploadConfig.provider = '@strapi/provider-upload-cloudinary';
    uploadConfig.providerOptions = {
      cloud_name: env('CLOUDINARY_NAME'),
      api_key: env('CLOUDINARY_KEY'),
      api_secret: env('CLOUDINARY_SECRET'),
    };
  }

  return {
    upload: {
      config: uploadConfig,
    },
    meilisearch: {
      config: {
        host: env('MEILISEARCH_HOST', 'http://localhost:7700'),
        apiKey: env('MEILI_MASTER_KEY'),
        post: {
          indexName: 'posts',
          entriesQuery: {
            fields: ['id', 'documentId', 'title', 'slug', 'excerpt', 'publishedAt'],
            filters: { publishedAt: { $notNull: true } },
          },
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            return {
              id: entry.id,
              documentId: entry.documentId,
              title: entry.title,
              slug: entry.slug,
              excerpt: entry.excerpt,
              publishedAt: entry.publishedAt,
            };
          },
        },
        tag: {
          indexName: 'tags',
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            return {
              id: entry.id,
              documentId: entry.documentId,
              name: entry.name,
              slug: entry.slug,
              description: entry.description,
            };
          },
        },
        category: {
          indexName: 'categories',
          transformEntry({ entry }: { entry: Record<string, unknown> }) {
            return {
              id: entry.id,
              documentId: entry.documentId,
              name: entry.name,
              slug: entry.slug,
              description: entry.description,
            };
          },
        },
      },
    },
  };
};
