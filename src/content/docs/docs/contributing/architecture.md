---
title: Architecture
description: How Worklio's services, realtime layer and data model fit together.
---

Worklio is a modular monolith: one FastAPI application, one Next.js web app, and a few supporting
services. This page explains how the pieces fit together. For settings see
[Configuration](/docs/self-hosting/configuration/); for pitfalls see [Lessons learned](/docs/contributing/lessons-learned/).

## System overview

<pre class="mermaid">
flowchart LR
  subgraph Browser
    Web[Next.js web app]
  end
  Web -- HTTPS REST + SSE --&gt; API
  Web -- one WebSocket /ws --&gt; API
  Web -- presigned GET --&gt; S3[(S3 / SeaweedFS)]
  Web -- WebRTC --&gt; LK[LiveKit server]

  subgraph Backend
    API[FastAPI API processes]
    Worker[Celery worker]
    Beat[Celery beat]
  end

  API -- SQL --&gt; PG[(Postgres 17 + pgvector)]
  API -- pub/sub, presence, rate limits --&gt; Redis[(Redis)]
  API -- upload / delete --&gt; S3
  API -- tasks --&gt; Redis
  Beat -- schedules --&gt; Redis
  Redis -- tasks --&gt; Worker
  Worker -- SQL --&gt; PG
  Worker -- publish events --&gt; Redis
  API -- AI requests --&gt; AI[Claude / Gemini / DeepSeek]
  Worker -- AI requests --&gt; AI
  API -. signs LiveKit tokens .-&gt; Web
</pre>

| Service | Role |
|---|---|
| `api` | FastAPI app (`backend/app/main.py`): REST, Server-Sent Events for AI streaming, the `/ws` WebSocket. Runs `alembic upgrade head` on start. Stateless apart from its own sockets, so you can run many. |
| `worker` | Celery worker: link unfurls, the `@worklio` AI agent, AI call summaries, call ring timeouts. |
| `beat` | Celery beat: periodic jobs (see [Workers and beat](#workers-and-beat)). Must run. |
| `postgres` | Source of truth for all data. `pgvector` image; the extension is created by the first migration. |
| `redis` | Realtime bus (pub/sub), presence, rate limits, huddle state, pending canvas updates, Celery broker. |
| `s3` | Object storage for uploads, avatars, workspace icons, recordings. SeaweedFS locally. |
| `livekit` | Media server for calls and huddles (audio, video, screen share). |

## Design rules

1. **Postgres is the source of truth.** Write and commit first, then publish the event to Redis.
   Redis is only the event bus and short-lived state, never message storage. Clients must never
   hear about state that could still roll back.
2. **Tenant isolation lives in `backend/app/api/deps.py`.** Use the `WorkspaceMembership` /
   `ChannelAccess` style dependencies; never query workspace data without them. Non-members get
   `404`, not `403`. Guests only see channels they were added to (`readable_channel_ids`).
3. **Horizontal fan-out.** Each API process holds its own sockets and subscribes to `rt:*` in
   Redis. Any process can publish; every process delivers to the sockets it holds. This is what lets
   the API scale behind a load balancer.
4. **Denormalise for tenant filters.** `messages.workspace_id` is stored so every tenant query can
   filter on it directly.
5. **Presence** is a Redis sorted set per user (`presence:conns:<user_id>`) of open connection ids,
   scored by last heartbeat. A user is online while one entry is fresher than 60 s, so multiple
   tabs and servers work and a crashed process cannot pin anyone online.
6. **Uploads** go through the API into S3. Downloads use short-lived presigned URLs signed for the
   public S3 host (`S3_PUBLIC_ENDPOINT_URL`).
7. **Policies and audit.** Admin-controlled actions call `require_policy`; admin actions call
   `record_audit` (`backend/app/admin.py`).

## Request flow

A typical write, for example posting a message:

1. The browser calls `POST /channels/{id}/messages` with `Authorization: Bearer <jwt>`.
2. `get_current_user` decodes the JWT; `require_channel_access` checks membership (404 otherwise).
3. The route writes the message, mentions and attachments and **commits**.
4. It publishes `message.created` to `rt:channel:<id>` (and activity events to `rt:user:<id>`).
5. Each API process receives the event from Redis and sends it to its local sockets that are
   subscribed to that channel.
6. Slow follow-up work (link unfurls, the AI agent) is queued to Celery and publishes its own
   events when done.

Large bodies (uploads, avatars, canvases, whiteboards, call notes) are size-capped in
`UploadSizeLimitMiddleware` before they are read.

## Realtime

One WebSocket per browser tab, opened by `frontend/src/hooks/use-realtime.ts`.

**Connecting.** The client connects to `/ws` and sends `{"type": "auth", "token": "<jwt>"}` as its
first frame, so the token never appears in URLs or logs (a `?token=` query parameter is still
accepted). The server loads the user's channels and workspaces and subscribes the socket. It
sends `{"type": "auth", ...}` again on the live socket to refresh the token. Close codes:
`1008` bad or missing auth, `4001` token expired (reconnect with a fresh token), `4003` session
revoked (for example the member was deactivated).

**Topics** (`backend/app/realtime/hub.py`):

| Topic | Carries |
|---|---|
| `rt:channel:<id>` | channel events: messages, reactions, typing, huddles, calls, whiteboard frames |
| `rt:user:<id>` | per-user events: channel joined/left, ringing calls, activity, reminders, session revoked |
| `rt:workspace:<id>` | workspace-wide: presence, channel created, user updated, public huddles |
| `rt:canvas:<id>` | Yjs updates, awareness and comments for sockets that joined that canvas |

**Client → server frames:** `auth`, `ping` (heartbeat, answered with `pong`), `typing`,
`subscribe` / `unsubscribe` (peek at a public channel without joining), `canvas.presence`,
`canvas.join`, `canvas.leave`, `canvas.update`, `canvas.awareness`, `whiteboard.ops`,
`whiteboard.pointer`. Typing, presence and relay frames are throttled per user.

**Server → client events** (main ones): `message.created`, `message.updated`, `message.deleted`,
`reaction.updated`, `thread.updated`, `typing`, `presence`, `channel.created`, `channel.updated`,
`channel.joined`, `channel.left`, `channel.member_joined`, `channel.member_left`,
`workspace.joined`, `workspace.updated`, `workspace.role_changed`, `user.updated`,
`huddle.started`, `huddle.updated`, `huddle.ended`, `call.ringing`, `call.ring_stopped`,
`call.updated`, `call.invite_updated`, `call.notes_updated`, `call.caption`, `board.updated`,
`whiteboard.ops`, `whiteboard.pointer`, `whiteboard.saved`, `canvas.*`, `activity.new`,
`reminder.due`, `session.revoked`, `resync`, `pong`. The full list is in the docstring of the
`/ws` endpoint in `backend/app/realtime/routes.py`.

**Missed events.** If an API process loses its Redis subscription, it sends `resync` to its
sockets when it reconnects. The client also emits `resync` to itself after its own reconnect.
Consumers refetch the latest page of whatever they show. Older gaps are not filled yet (see
"Pagination v2" in [Roadmap](/docs/contributing/roadmap/)).

## Data model overview

All tables use UUID primary keys and timestamps (`backend/app/models/base.py`). Main groups:

| Area | Models (`backend/app/models/`) |
|---|---|
| Identity | `User` (incl. `preferences` JSON for appearance), `AuthSession` (rotating refresh tokens) |
| Tenancy | `Workspace`, `WorkspaceMember` (role: owner, admin, member, guest) |
| Channels | `Channel` (public, private, DM, group DM), `ChannelMember`, `ChannelPref` |
| Messages | `Message` (threads via parent id), `MessageMention`, `MessageReaction`, `Attachment`, `MessageRevision`, `MessagePin`, `MessageForward`, `MessageUnfurl`, `LinkPreview` |
| Messaging extras | `Poll`, `PollOption`, `PollVote`, `ScheduledMessage`, `ChannelBookmark`, `UserGroup`, `UserGroupMember` |
| Productivity | `ActivityEvent`, `ActivityRead`, `ActivityState`, `SavedItem`, `Reminder`, `SidebarSection`, `ThreadSubscription` |
| Calls | `Call`, `CallInvite`, `CallTranscriptSegment` |
| Collaboration | `Canvas`, `CanvasMember`, `CanvasComment`, `Whiteboard`, `Board`, `BoardColumn`, `BoardCard`, `BoardField`, `BoardSubtask`, `BoardCardComment` |
| AI | `AIConversation`, `AITurn`, `AIUsage`, `WorkspaceAISettings` (encrypted keys), `AIAgentInstall` |
| Admin | `AuditEvent`, `InviteLink`, `DeactivatedMember`; settings and policies live on the workspace |

Migrations live in `backend/alembic/versions/` and must keep a single head.

## Calls and huddles

- Each channel has one LiveKit room, `huddle-<channel_id>`.
- To join, the browser calls the API (`POST /channels/{id}/huddle/join`, or the call endpoints).
  The API checks channel access (starting a new call also checks the `start_huddles` policy), then returns the LiveKit URL
  (`LIVEKIT_PUBLIC_URL`) and an access token it signs with `LIVEKIT_API_KEY` /
  `LIVEKIT_API_SECRET` (`backend/app/realtime/huddles.py`). The browser then connects to LiveKit
  directly; media never passes through the API.
- Who is in a huddle is tracked in Redis by heartbeats; a sweeper removes stale participants.
- **Ringing calls** (`backend/app/calls.py`) wrap the same room. Starting a call sends
  `call.ringing` to each invitee's `rt:user` topic; accept, decline, cancel and timeouts send
  `call.ring_stopped` / `call.updated`. Ring timeouts are enforced three ways (Celery countdown
  task, in-process sweeper, and lazy expiry on read) so a missing worker cannot leave phones
  ringing. A call card in the channel shows live state and duration.
- **Captions and summaries.** Live captions come from the browser's speech recognition. Final
  segments are posted to `POST /calls/{id}/captions`, broadcast as `call.caption`, and stored as
  `CallTranscriptSegment`. After the call, a Celery task can write an AI summary.
- Camera effects (blur, virtual backgrounds) run in the browser with `@livekit/track-processors`.

## Collaboration

**Canvas docs (Yjs).** The editor is TipTap with the Yjs collaboration extension
(`frontend/src/components/canvas/yjs-provider.ts`). Yjs traffic goes over the same `/ws` socket:
`canvas.join`, then `canvas.update` (document updates) and `canvas.awareness` (cursors). The server
(`backend/app/canvas_collab.py`) checks access, appends each update to a Redis list
(`canvas:pending:<id>`) before relaying it on `rt:canvas:<id>`, and flushes within about a second:
it locks the canvas row, merges stored state and pending updates with `pycrdt`, writes the
compacted state, then trims the list. Pending updates survive a process crash and are merged on
the next flush or join. On shutdown the API flushes all canvases.

**Whiteboard (Excalidraw).** Scene changes are relayed live as `whiteboard.ops` and
`whiteboard.pointer` frames to the channel topic, rate limited per user
(`WHITEBOARD_OPS_PER_SECOND`, `WHITEBOARD_POINTER_PER_SECOND`). The scene is persisted with
`PUT /channels/{id}/whiteboard`, which broadcasts `whiteboard.saved`.

**Boards and lists.** Normal REST resources (`backend/app/api/routes/board.py`) that broadcast
`board.updated`.

## Worklio AI

Code: `backend/app/ai/`, routes in `backend/app/api/routes/ai.py` and `ai_agents.py`.

- **Providers** (`providers.py`, `client.py`): Anthropic (Claude) through the `anthropic` SDK;
  Gemini and DeepSeek through their OpenAI-compatible endpoints with the `openai` SDK. A workspace
  can use the server's `ANTHROPIC_API_KEY` or its own key set in Workspace settings → AI.
- **Keys** (`keys.py`): encrypted with Fernet using a key derived from `SECRET_KEY` (HKDF). Never
  logged or returned.
- **Retrieval** (`retrieval.py`): tool-based. The model calls tools that run Worklio's own
  permission-checked search and message reads for the asking user. There is no vector index in v1,
  so results are always fresh and permission-safe by construction.
- **Features**: Ask (streamed over SSE, with citations and saved conversations), catch-up, channel
  and thread summaries, composer rewrite/translate, message translation, thread → tasks, the
  `@worklio` channel agent (runs in the Celery worker), and call summaries.
- **Gating**: `503 ai_not_configured` with no key; the `use_ai` policy; a per-user rate limit
  (`AI_RATE_LIMIT_REQUESTS` per `AI_RATE_LIMIT_WINDOW_SECONDS`); usage recorded in `AIUsage`.

## Admin and permissions

- Roles: owner, admin, member, guest (`WorkspaceRole`). Guests are limited to channels they are
  added to.
- Workspace policies (`backend/app/admin.py`), each allowing everyone or admins:
  `create_public_channels`, `create_private_channels`, `invite_members`, `create_user_groups`,
  `start_huddles`, `use_ai`, `install_apps`, `archive_channels`. Routes call
  `require_policy(db, membership, "<name>")`, which answers `403 {"detail": "policy:<name>"}`.
- Member lifecycle: role changes, deactivation and reactivation, ownership transfer. Deactivating a
  member revokes their live sessions (`session.revoked`, close code 4003).
- Audit log: `record_audit` adds an `AuditEvent` in the same transaction as the change;
  `GET /workspaces/{id}/audit-log` lists them.
- Invite links: `/invites/{token}` to preview and accept.

## Workers and beat

Celery app: `backend/app/workers/celery_app.py`. Tasks: `tasks.py`, `ai_tasks.py`.

| Job | Trigger | What it does |
|---|---|---|
| `deliver_reminders` | beat, every 30 s | Sends due reminders (notification + Worklio bot DM) |
| `send_due_scheduled_messages` | beat, every 30 s | Posts scheduled messages |
| `delete_orphaned_uploads` | beat, hourly | Deletes uploads never attached to a message after `ORPHAN_UPLOAD_TTL_HOURS` |
| `unfurl_message` | queued on send | Fetches link previews (SSRF-safe) and broadcasts them |
| `expire_call_invites` | queued with a countdown | Stops ringing after the timeout |
| `run_agent` | queued on `@worklio` mention | Runs the AI agent and posts its reply |
| `summarize_call` | queued after a call | Writes the AI call summary |

If beat is not running, reminders and scheduled messages silently never fire.

## Storage

`backend/app/core/storage.py` uses boto3 with path-style addressing, so any S3-compatible service
works. Two clients exist: an internal one for `S3_ENDPOINT_URL` (uploads, deletes) and a public one
for `S3_PUBLIC_ENDPOINT_URL` (presigned GET URLs, which embed the host). The bucket is created on
API start if missing. Only safe content types are served inline; others are forced to download.

## Frontend structure

Next.js App Router in `frontend/src/app/`:

- `/login`, `/new` (create workspace), `/invite/[token]`
- `/w/[workspaceId]` workspace shell with `c/[channelId]`, `activity`, `threads`, `unreads`,
  `drafts`, `later`, `files`, `directory`, `huddles`, `canvas`, `settings`

Key pieces:

- **Providers.** `AppearanceProvider` wraps the whole app (root layout). Inside a workspace,
  `WorkspaceProvider` (`components/workspace/provider.tsx`) holds shared state and an event bus
  that components subscribe to with `useWorkspaceEvents`. `CallProvider` and `HuddleProvider`
  manage ringing calls and the LiveKit room.
- **Realtime hook.** `hooks/use-realtime.ts` keeps one reconnecting socket per tab, sends the auth
  frame and heartbeats, re-subscribes peeked channels and emits `resync` after reconnects. Pure
  reducers in `lib/messages.ts` apply events to message lists.
- **API client.** `lib/api.ts` is a typed fetch wrapper. The JWT lives in `localStorage`
  (per origin).
- **Appearance.** Themes, fonts and tokens are in `lib/appearance.ts`. Preferences are saved to
  `users.preferences` (`PATCH /auth/me/preferences`) and cached in `localStorage`. An inline
  pre-paint script (`AppearanceScript` in `components/appearance-provider.tsx`, rendered in
  `<head>`) applies them before first paint, so there is no theme flash.
- **UI kit.** shadcn/ui components on Base UI in `components/ui/`. Feature folders under
  `components/` (chat, messaging, workspace, calls, huddle, canvas, whiteboard, board, ai, admin,
  recording, voice, effects, annotate, preferences, profile, views).
