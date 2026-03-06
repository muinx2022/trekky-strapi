FROM node:22-alpine

RUN apk add --no-cache libc6-compat python3 make g++
RUN corepack enable pnpm && pnpm config set store-dir /pnpm/store

WORKDIR /app

# Copy workspace manifests first (layer cache)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/admin/package.json ./apps/admin/package.json

# Install all workspace deps (shamefully-hoist needed for Strapi's Vite build with pnpm)
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --shamefully-hoist

# Copy Strapi source
COPY apps/api ./apps/api

# Build Strapi admin panel
WORKDIR /app/apps/api
RUN pnpm build

# Create required directories
RUN mkdir -p public/uploads tmp/formidable

ENV NODE_ENV=production

EXPOSE 1337

CMD ["pnpm", "start"]
