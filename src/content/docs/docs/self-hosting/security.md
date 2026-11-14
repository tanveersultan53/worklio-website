---
title: Security
description: How Worklio protects your data, and how to report a vulnerability.
---

## Reporting a vulnerability

Please report security issues **privately** through GitHub's private vulnerability reporting:
open the repository's **Security** tab and choose **Report a vulnerability**.

- Do not open a public issue, pull request or discussion for a security problem.
- Include the affected version or commit, steps to reproduce, and the impact you expect.
- We will acknowledge the report, keep you updated while we fix it, and credit you in the release
  notes if you want.

Please give us a reasonable chance to fix the issue before disclosing it publicly.

## Supported versions

Worklio has no stable release line yet. Security fixes land on `main` only.

| Version | Supported |
|---|---|
| `main` | Yes |
| anything else | No |

## Security model

A short summary of how Worklio protects data. File paths point at the code that does it.

- **Tenant isolation.** Every workspace- or channel-scoped route goes through the dependencies in
  `backend/app/api/deps.py`. Users who are not members get `404`, not `403`, so the API does not
  reveal which workspaces or channels exist. Guests only see channels they were added to.
- **Authentication.** Passwords are hashed with Argon2 (`pwdlib`). Access tokens are HS256 JWTs
  signed with `SECRET_KEY`, with an expiry (`ACCESS_TOKEN_EXPIRE_MINUTES`). Refresh tokens are
  random, stored only as a SHA-256 hash, and rotated on every use; reusing an already-rotated
  token revokes that whole sign-in (`backend/app/core/sessions.py`). Login takes the same
  time for unknown emails. The WebSocket receives the token in its first frame, not in the URL,
  and closes when the token expires or the session is revoked (for example when an admin
  deactivates a member). See `backend/app/core/security.py` and `backend/app/realtime/routes.py`.
- **SECRET_KEY rule.** Outside `ENVIRONMENT=development` or `test` the API refuses to start
  unless `SECRET_KEY` is at least 32 bytes and not a known placeholder
  (`backend/app/core/config.py`).
- **Encrypted AI keys.** Workspace AI provider keys are encrypted at rest with Fernet, using a key
  derived from `SECRET_KEY` with HKDF (`backend/app/ai/keys.py`). Keys are never logged or returned
  by the API; admins only see a short hint such as `…abcd`. Rotating `SECRET_KEY` makes stored keys
  unreadable, and admins must enter them again.
- **Permission-aware AI.** The AI retrieves workspace content only through tools that call the
  same permission-checked search users use (`backend/app/ai/retrieval.py`), so it cannot surface
  messages the asking user cannot read. Admins can restrict AI with the `use_ai` workspace policy.
- **Roles, policies and audit log.** Admin-controlled actions are gated with `require_policy`, and
  admin actions are written to an audit log (`backend/app/admin.py`).
- **File downloads.** Files are stored in S3 and served through short-lived presigned URLs
  (1 hour). Only a safe list of content types is served inline; everything else (for example HTML
  and SVG) is downloaded as an attachment (`backend/app/core/storage.py`). Request bodies are size
  capped before they are read (`backend/app/main.py`).
- **Rate limits.** Login, registration and token refresh are rate limited per IP (login also per email), and AI requests
  have a per-user budget. Limits use Redis, so they hold across API processes
  (`backend/app/core/ratelimit.py`, `backend/app/api/routes/ai.py`).
- **SSRF-safe link previews.** Link unfurls resolve the host first and refuse private, loopback,
  link-local and other non-public addresses. Redirects are followed manually, a limited number of
  times, and every hop is checked again (`backend/app/messaging_extras.py`).

## Production hardening checklist

The defaults in `.env.example`, `docker-compose.yml` and `infra/seaweedfs/s3.json` are for local
development only. Before you expose Worklio to anyone else:

- [ ] Set `ENVIRONMENT=production`.
- [ ] Set `SECRET_KEY` to at least 32 random bytes, for example
      `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Keep it stable: changing it
      signs everyone out and makes stored AI keys unreadable.
- [ ] Use a real S3 service or your own S3 credentials. Replace the dev identity in
      `infra/seaweedfs/s3.json` and update `S3_ACCESS_KEY` / `S3_SECRET_KEY` to match.
- [ ] Run LiveKit without `--dev`, with your own API key and secret
      (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) and TLS. Set `LIVEKIT_PUBLIC_URL` to a `wss://` URL.
- [ ] Set `CORS_ORIGINS` to exactly the origins that serve your web app.
- [ ] Serve the web app and API over HTTPS, and the WebSocket over WSS
      (`NEXT_PUBLIC_API_URL=https://…`, `NEXT_PUBLIC_WS_URL=wss://…`). Set `API_PUBLIC_URL` and
      `S3_PUBLIC_ENDPOINT_URL` to their public HTTPS addresses.
- [ ] Use strong Postgres credentials, and do not publish Postgres, Redis or the S3 admin ports to
      the internet.
- [ ] Run Celery **beat** as well as the worker. Without beat, reminders and scheduled messages
      never fire and orphaned uploads are never cleaned up.
- [ ] Run the API behind a reverse proxy with `uvicorn --proxy-headers` (and trusted proxy IPs),
      so rate limits see the real client IP. Do not use `--reload` in production.
- [ ] Back up Postgres and the S3 bucket, and test restoring them.
- [ ] Keep dependencies and container images up to date.
