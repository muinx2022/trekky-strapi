import type { Core } from '@strapi/strapi';
import fs from 'node:fs';
import path from 'node:path';

const uploadTmpDir = path.join(process.cwd(), 'tmp', 'formidable');
fs.mkdirSync(uploadTmpDir, { recursive: true });

const config: Core.Config.Middlewares = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      multipart: true,
      formidable: {
        uploadDir: uploadTmpDir,
        keepExtensions: true,
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];

export default config;
