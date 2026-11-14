---
title: Deploy to production
description: Run Worklio on your own server with Docker Compose and a reverse proxy.
---

This guide runs the whole stack on one Linux host with Docker Compose. Each service is a plain
container, so the same images also work on Kubernetes, ECS or Fly with your own manifests.

## What you need

- A host with Docker and the Compose plugin (2 vCPU / 4 GB RAM is enough for a small team).
- Three DNS names pointing at it, for example `app.example.com` (web), `api.example.com` (API and
  WebSocket) and `rtc.example.com` (LiveKit calls).
- A TLS-terminating reverse proxy (Caddy, Nginx, Traefik or a cloud load balancer).
- S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO) with a private bucket.
- Firewall: 443/tcp for the proxy, plus 7881/tcp and 7882/udp for call media.

## 1. Configure

```bash
cp .env.production.example .env.production
```

Fill in every value. In particular:

- `SECRET_KEY`: 32+ random bytes. The API refuses to start with a weak key outside development.
  Changing it later signs everyone out and makes stored AI provider keys unreadable.
- `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`: your own values. The API refuses LiveKit's public
  dev keys outside development. `LIVEKIT_NODE_IP` is the host's public IP.
- `CORS_ORIGINS`: exactly the web origin, e.g. `https://app.example.com`.
- `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL`: baked into the web image at build time, so
  rebuild `web` after changing them.
- `DATABASE_URL` must use the same password as `POSTGRES_PASSWORD`.

## 2. Start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

The API applies database migrations on start. `beat` must be running: reminders, scheduled
messages and upload cleanup depend on it. Ports are bound to `127.0.0.1` so only the proxy can
reach them (except LiveKit media ports).

## 3. Reverse proxy

Example `Caddyfile` (Caddy fetches TLS certificates automatically):

```
app.example.com {
	reverse_proxy 127.0.0.1:3000
}

api.example.com {
	# Plain reverse_proxy also handles the /ws WebSocket upgrade.
	reverse_proxy 127.0.0.1:8000
}

rtc.example.com {
	reverse_proxy 127.0.0.1:7880
}
```

The API runs uvicorn with `--proxy-headers`, so rate limits see real client IPs through the proxy.

## 4. Check it

- `https://api.example.com/health` returns `{"status": "ok"}`.
- Sign up at `https://app.example.com/signup`, create a workspace, upload a file, and start a
  huddle with a second account.
- Interactive API docs (`/docs`) are disabled outside development.

## Operations

- **Backups:** back up the `pgdata` volume (or run `pg_dump` on a schedule) and enable versioning
  on the S3 bucket. Redis holds only transient state (presence, queues, collaboration buffers).
- **Upgrades:** `git pull`, then rerun the `up -d --build` command. Migrations run on API start.
- **Scaling:** `WEB_CONCURRENCY` sets API worker processes. The API is stateless (realtime fans
  out through Redis), so you can run more `api` containers behind the proxy.
- **Logs:** `docker compose -f docker-compose.prod.yml logs -f api worker beat`.

See [SECURITY.md](/docs/self-hosting/security/) for the full hardening checklist.
