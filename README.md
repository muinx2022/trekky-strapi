# Demo Starter Monorepo

Starter structure:

- `apps/api`: Strapi (`latest`) with `posts`, `categories`, `comments` content-types.
- `apps/web`: Next.js (`latest`) consuming Strapi REST API.
- `apps/admin`: Next.js + Refine + shadcn using Strapi REST API.

## Requirements

- Node.js `>=20`
- pnpm `>=10`

## Quick Start

```bash
pnpm install
```

Copy env files:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/admin/.env.example apps/admin/.env.local
```

Run all apps:

```bash
pnpm dev
```

Run each app separately:

```bash
pnpm dev:api
pnpm dev:web
pnpm dev:admin
```

## Notes

- First Strapi start will ask to create an admin user.
- `http://localhost:3001` (admin app) opens login form.
- Admin app login flow:
  - authenticate with Strapi `POST /api/auth/local`
  - fetch `GET /api/users/me?populate=role`
  - allow access only when `role.name === "Admin"` (users-permissions role)
- `categories` supports multi-level via `parent` / `children` self-relation.
- `comments` is polymorphic-ready: `targetType` + `targetDocumentId` (not hard relation to posts).
- Admin endpoints are consolidated in `api::management` for easier permission setup:
  - `/api/management/dashboard`
  - `/api/management/posts`
  - `/api/management/categories`
  - `/api/management/comments`
  - `/api/management/users`
  - `/api/management/roles`
- These `management/*` endpoints are protected by policy `global::is-admin-user` and require a valid users-permissions JWT of role `Admin`, so you do not need to modify public role permissions of default content routes.
- Admin UI includes CRUD for posts/comments/categories/users.
- Categories support tree ordering with drag-drop:
  - drop on card: make child
  - drop on dashed line: move after target in same level
- For public access from web/admin, configure Strapi roles & permissions for:
  - `post`: `find`, `findOne`
  - `category`: `find`, `findOne`
  - `comment`: `find`, `findOne` (and `create` if you add submit form)
- After creating content, web is available at `http://localhost:3000` and admin at `http://localhost:3001` if run concurrently.

## Production CI/CD

- GitHub Actions workflow: `.github/workflows/deploy.yml`
- Trigger: push to `main` or manual dispatch
- Behavior:
  - detect changed app services (`api`, `web`, `admin`)
  - build and push changed Docker images to Docker Hub under `muinx`
  - call a deploy webhook after all image pushes succeed
- Runtime on VPS:
  - `deploy-listener` runs as a Docker service in the production compose stack
  - the existing Cloudflare tunnel should route a public hostname to `http://trekky-deploy-listener:8787`
- Required GitHub secrets:
  - `DOCKERHUB_USERNAME`
  - `DOCKERHUB_TOKEN`
  - `DEPLOY_WEBHOOK_URL`
  - `DEPLOY_WEBHOOK_TOKEN`
- VPS listener setup files live in `deploy/vps`
