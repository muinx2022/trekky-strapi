FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat
RUN corepack enable pnpm && pnpm config set store-dir /pnpm/store

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

# Install deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# Copy admin source
COPY apps/admin ./apps/admin

ENV STRAPI_INTERNAL_URL=http://trekky-api:1337
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app/apps/admin
RUN pnpm build

# --- Runner ---
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static

WORKDIR /app/apps/admin

EXPOSE 3001

CMD ["node", "server.js"]
