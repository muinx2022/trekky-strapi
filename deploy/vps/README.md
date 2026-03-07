# VPS Deploy Listener

This folder contains the production deploy listener used by GitHub Actions.

## Files

- `webhook-listener.mjs`: receives `POST /deploy` and validates `x-deploy-token`.
- `deploy.sh`: pulls and restarts only `api`, `web`, `admin` in the compose directory.
- `Dockerfile`: container image for the listener with Node.js and Docker CLI.
- `trekky-deploy.env.example`: legacy host-service example env file.
- `trekky-deploy.service`: legacy `systemd` unit if you ever run the listener on the host.

## Request contract

- Method: `POST`
- Path: `/deploy`
- Header: `x-deploy-token: <shared-secret>`
- Body:

```json
{
  "ref": "refs/heads/main",
  "sha": "abc123",
  "services": ["api", "web"]
}
```

## Recommended setup

1. Set `DEPLOY_WEBHOOK_TOKEN` in the production `.env` next to `docker-compose.yml`.
2. Start the listener container:

```bash
docker compose up -d --build deploy-listener
```

3. The listener joins `gikky-network` with container name `trekky-deploy-listener`.
4. In Cloudflare Tunnel Public Hostname, route the deploy hostname to:
   - Type: `HTTP`
   - URL: `trekky-deploy-listener:8787`
5. Use the public URL with path `/deploy` as GitHub secret `DEPLOY_WEBHOOK_URL`.

## Cloudflare setup

Create a new Public Hostname in the same tunnel already used by `gikky-cloudflared`.

- Subdomain: `deploy`
- Domain: your production zone, for example `trekky.net`
- Path: leave empty in Cloudflare; GitHub will call `/deploy`
- Service type: `HTTP`
- URL: `http://trekky-deploy-listener:8787`
- Additional protection:
  - keep the endpoint unlisted
  - rely on `x-deploy-token` validation in the listener
  - optionally add Cloudflare Access later if you want a second auth layer

## Manual checks

- Local health check from VPS:

```bash
docker compose exec deploy-listener wget -qO- http://127.0.0.1:8787/health
```

- Test deploy:

```bash
curl -X POST https://deploy.example.com/deploy \
  -H 'content-type: application/json' \
  -H 'x-deploy-token: replace-with-real-secret' \
  -d '{"ref":"refs/heads/main","sha":"manual-test","services":["web"]}'
```
