import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => ({
  upload: {
    config: {
      security: {
        // Allow common safe types and block dangerous script payloads.
        allowedTypes: [
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          'image/avif',
          'video/mp4',
          'application/pdf',
          'text/plain',
        ],
        deniedTypes: ['text/html', 'application/javascript', 'image/svg+xml'],
      },
      sizeLimit: env.int('UPLOAD_SIZE_LIMIT', 10 * 1024 * 1024),
    },
  },
});

export default config;
