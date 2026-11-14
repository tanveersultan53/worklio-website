---
title: Configuration
description: Every environment variable Worklio reads, with defaults.
---

The API reads settings from environment variables and from a `.env` file
(`backend/app/core/config.py`, pydantic-settings). Names are case-insensitive: the field
`secret_key` is set with `SECRET_KEY`. With Docker Compose, the `api`, `worker` and `beat`
services all load the root `.env` (`env_file: .env`).

Start from [`.env.example`](https://github.com/tanveersultan53/worklio/blob/main/.env.example). Its values are dev-only placeholders.

Note that the defaults in `config.py` (used when a variable is missing) assume you run the API
on your host. `.env.example` overrides them with Docker service names (`postgres`, `redis`, `s3`).

## Core

| Variable | Default | Purpose |
|---|---|---|
| `ENVIRONMENT` | `development` | `development`, `test` or anything else (for example `production`). Outside `development`/`test` a strong `SECRET_KEY` and non-default LiveKit keys are required, and the interactive API docs are disabled. |
| `WEB_CONCURRENCY` | `2` | Uvicorn worker processes in the production image (`backend/Dockerfile`). |
| `SECRET_KEY` | `change-me` | Signs JWTs and derives the key that encrypts workspace AI keys. Outside development the API refuses to start unless it is at least 32 bytes and not a known placeholder. Changing it signs everyone out and makes stored AI keys unreadable. |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Lifetime of access tokens. The WebSocket closes with code 4001 when its token expires. |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `30` | Lifetime of refresh tokens. Each refresh rotates the token and extends the session. |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list of allowed browser origins. Matching is exact (scheme, host and port). |
| `API_PUBLIC_URL` | `http://localhost:8000` | Public base URL of the API, used for absolute links such as avatar URLs. |

## Database, Redis and Celery

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://worklio:worklio@localhost:5432/worklio` | Async SQLAlchemy URL. In Compose: host `postgres`. |
| `REDIS_URL` | `redis://localhost:6379/0` | Realtime pub/sub, presence, rate limits, huddle and canvas state. In Compose: `redis://redis:6379/0`. From the host use port `6380`. |
| `CELERY_BROKER_URL` | `redis://localhost:6379/1` | Celery broker. In Compose: `redis://redis:6379/1`. |

## File storage (S3)

| Variable | Default | Purpose |
|---|---|---|
| `S3_ENDPOINT_URL` | none (AWS) | S3 endpoint the API uses. Leave unset for AWS S3. In Compose: `http://s3:8333`. |
| `S3_PUBLIC_ENDPOINT_URL` | none (falls back to `S3_ENDPOINT_URL`) | Endpoint browsers can reach. Presigned download URLs are signed for this host. |
| `S3_ACCESS_KEY` | empty | S3 access key. Must match `infra/seaweedfs/s3.json` locally. |
| `S3_SECRET_KEY` | empty | S3 secret key. Must match `infra/seaweedfs/s3.json` locally. |
| `S3_BUCKET` | `worklio-uploads` | Bucket name. Created on API start if it does not exist. |
| `MAX_UPLOAD_BYTES` | `26214400` (25 MiB) | Max size of a regular upload. |
| `MAX_RECORDING_BYTES` | `314572800` (300 MiB) | Max size of screen recordings and video clips. |
| `ORPHAN_UPLOAD_TTL_HOURS` | `24` | Uploads never attached to a message are deleted after this (beat job). |
| `MAX_AVATAR_BYTES` | `5242880` (5 MiB) | Max profile photo size. |

## Canvas and whiteboard

| Variable | Default | Purpose |
|---|---|---|
| `MAX_CANVAS_BYTES` | `1048576` (1 MiB) | Max serialized canvas content (also used for call notes). |
| `MAX_WHITEBOARD_BYTES` | `5242880` (5 MiB) | Max request body when saving a whiteboard scene. |
| `WHITEBOARD_OPS_PER_SECOND` | `30` | Per-user rate limit for live whiteboard change frames. |
| `WHITEBOARD_POINTER_PER_SECOND` | `20` | Per-user rate limit for live pointer frames. |

## Calls and huddles (LiveKit)

| Variable | Default | Purpose |
|---|---|---|
| `LIVEKIT_PUBLIC_URL` | `ws://localhost:7880` | LiveKit URL browsers connect to. Use `wss://` in production. |
| `LIVEKIT_API_KEY` | `devkey` | Key used to sign LiveKit access tokens. `devkey` matches `livekit-server --dev`. |
| `LIVEKIT_API_SECRET` | `secret` | Secret used to sign LiveKit access tokens. `secret` matches `--dev`. |
| `HUDDLE_TOKEN_TTL_HOURS` | `6` | Lifetime of LiveKit access tokens. |

## Rate limits

| Variable | Default | Purpose |
|---|---|---|
| `LOGIN_RATE_LIMIT_PER_IP` | `20` | Login attempts per minute per client IP. |
| `LOGIN_RATE_LIMIT_PER_EMAIL` | `10` | Login attempts per minute per email. |
| `REGISTER_RATE_LIMIT_PER_IP` | `10` | Registrations per minute per client IP. |
| `REFRESH_RATE_LIMIT_PER_IP` | `120` | Token refreshes per minute per client IP. |

Behind a proxy, run uvicorn with `--proxy-headers` so the limits see the real client IP.

## Worklio AI

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | empty | Optional server-wide Claude key. Admins can instead set a Claude, Gemini or DeepSeek key per workspace in Workspace settings → AI. With no key, AI endpoints return `503 ai_not_configured`. |
| `AI_MODEL` | `claude-opus-5-5` | Claude model id used with the server key, exactly as written. |
| `AI_RATE_LIMIT_REQUESTS` | `40` | AI requests allowed per user per window, across all AI features. |
| `AI_RATE_LIMIT_WINDOW_SECONDS` | `600` | Length of that window. |
| `AI_REQUEST_TIMEOUT` | `300.0` | Seconds before a single AI request is abandoned. |

## Docker Compose variables

Used by `docker-compose.yml` (read from the root `.env`):

| Variable | Example | Purpose |
|---|---|---|
| `POSTGRES_USER` | `worklio` | Postgres superuser created on first start. |
| `POSTGRES_PASSWORD` | `worklio` | Its password. Must match `DATABASE_URL`. |
| `POSTGRES_DB` | `worklio` | Database created on first start. |

Other Compose facts: Redis is published on host port `6380`; SeaweedFS reads credentials from
`infra/seaweedfs/s3.json`; LiveKit runs with `--dev --bind 0.0.0.0 --node-ip 127.0.0.1`, which uses
the key pair `devkey` / `secret`.

## Web app (Next.js)

The web app reads only these, at build time. Set them in `frontend/.env.local` (copy
`frontend/.env.example`) or in the environment when running `npm run build`. The root `.env` is not
read by Next.js.

| Variable | Default | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL of the API. |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8000` | Base URL for the WebSocket (`/ws` is appended). Use `wss://` in production. |
| `NEXT_DEV_ALLOWED_ORIGINS` | `127.0.0.1` | Dev only. Comma-separated extra hosts allowed to load the dev server (e.g. a LAN IP for two-account testing). Set in `frontend/.env.local`. |

For two-account testing on a second host (for example `127.0.0.1`), that host must be listed in
`NEXT_DEV_ALLOWED_ORIGINS` in `frontend/.env.local` (read by `allowedDevOrigins` in `frontend/next.config.ts`), and its origin must be in `CORS_ORIGINS`.
