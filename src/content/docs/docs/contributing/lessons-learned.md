---
title: Lessons learned
description: Pitfalls we hit while building Worklio and how we fixed them.
---

Practical problems we hit while building Worklio, why they happened and how we fixed them. Read
this before working in the same area. Each entry is **problem → cause → fix**, with the files
involved.

## Frontend: React, Next.js and Base UI

### Dropdown label crashes the menu
- **Problem:** opening a dropdown menu threw an error and the menu did not render.
- **Cause:** our `DropdownMenuLabel` wraps Base UI's `Menu.GroupLabel`, which needs a
  `Menu.Group` around it. Used directly inside `DropdownMenuContent` it has no group context.
- **Fix:** always put `DropdownMenuLabel` inside `DropdownMenuGroup`.
  See `frontend/src/components/ui/dropdown-menu.tsx`.

### Base UI triggers use render props, not `asChild`
- **Problem:** shadcn examples written for Radix (`<Trigger asChild><Button/></Trigger>`) render
  a button inside a button, which is invalid HTML and causes hydration errors.
- **Cause:** our shadcn components are built on Base UI. Base UI composes with a `render` prop.
- **Fix:** use `render={<Button … />}` on triggers, and never nest a `<button>` inside another
  interactive element. When a `Button` renders a non-button element such as a `Link`, pass
  `nativeButton={false}` (for example `frontend/src/components/admin/members-tab.tsx`).

### `useSyncExternalStore` infinite loop
- **Problem:** React reported "The result of getServerSnapshot should be cached" and the page hit
  an infinite render loop.
- **Cause:** `getServerSnapshot` returned a new empty array on every call, so React saw a new value
  each time.
- **Fix:** return a stable constant. `frontend/src/lib/toast.ts` uses a module-level
  `const EMPTY: Toast[] = []` for both the initial state and `getServerSnapshot`. The same applies
  to `getSnapshot`: return the same reference until the data really changes.

### Hydration mismatches from client-only values
- **Problem:** "Hydration failed because the server rendered text didn't match the client" warnings.
- **Cause:** rendering values that only exist in the browser (`localStorage`, the current time, the
  system colour scheme) during the first render. The server rendered defaults, the client rendered
  something else.
- **Fix:** render the defaults until hydrated, then switch. `AppearanceProvider` uses a
  `useSyncExternalStore`-based `hydrated` flag and shows `DEFAULT_PREFERENCES` before it
  (`frontend/src/components/appearance-provider.tsx`). Theme colours themselves are applied before
  paint by an inline script, so there is no flash.

### `useSearchParams` needs a Suspense boundary
- **Problem:** Next.js reported an error for pages that read search params outside a Suspense boundary.
- **Cause:** `cacheComponents: true` in `frontend/next.config.ts` (Next 16) requires client hooks
  that depend on the request, like `useSearchParams`, to sit under a `<Suspense>` boundary.
- **Fix:** keep `page.tsx` a thin wrapper that renders the client view inside `<Suspense>`, as in
  `frontend/src/app/w/[workspaceId]/c/[channelId]/page.tsx`.

### Next dev blocks a second hostname
- **Problem:** opening the dev server on `127.0.0.1:3000` or a LAN address loaded HTML but no
  scripts, so the page never became interactive.
- **Cause:** Next.js dev blocks cross-origin requests for dev assets from hosts it does not know.
- **Fix:** list the extra hosts in `NEXT_DEV_ALLOWED_ORIGINS` (`frontend/.env.local`), which feeds `allowedDevOrigins` in `frontend/next.config.ts`. Keep personal hostnames out of committed config.

### A CSS variable that references itself breaks fonts silently
- **Problem:** the chosen font was ignored and text fell back to the browser default, with no error.
- **Cause:** a declaration like `--font-sans: var(--font-sans)` is a cycle; CSS treats the variable
  as invalid, so every rule using it falls back.
- **Fix:** point theme variables at differently named source variables. `globals.css` now uses
  `--font-sans: var(--app-font, var(--font-inter)), …`, where `--font-inter` comes from
  `next/font` (`frontend/src/app/layout.tsx`).

### Avatar initials showed "A(" for "Alice (you)"
- **Problem:** labels decorated with "(you)", "[bot]" and similar produced wrong initials.
- **Cause:** initials were taken from the raw display label.
- **Fix:** strip bracketed asides (and anything after an unclosed opener) before taking initials.
  See `initials()` in `frontend/src/components/chat/user-avatar.tsx`.

### Opening a document saved a new version
- **Problem:** just opening a canvas created a new version, bumped the version number and caused
  false conflicts for other viewers.
- **Cause:** the editor normalises content on load, which fired the change handler and an autosave.
- **Fix:** skip unchanged saves on both sides. The client compares the normalised draft with the
  last server content before saving (`frontend/src/components/huddle/call-window/notes-panel.tsx`
  uses the same save machine as the channel canvas). The server returns early without bumping the
  version when title and content are unchanged (`save_channel_canvas` in
  `backend/app/api/routes/canvas.py`).

## Backend and API

### CORS errors from a host that "is" in the list
- **Problem:** the browser reported CORS errors for an origin that looked allowed.
- **Cause:** `CORS_ORIGINS` is matched exactly (`backend/app/main.py`, `CORSMiddleware`). Scheme,
  port and hostname must match what the browser sends, including case. macOS `.local` hostnames
  are a common trap (the hostname the browser sends may differ in case from what you typed), as are
  `localhost` vs `127.0.0.1` and `[::1]`.
- **Fix:** copy the exact origin from the browser's request `Origin` header into `CORS_ORIGINS`
  and restart the API.

### Commit first, then publish
- **Problem:** clients could see events for data that did not exist yet (or never would, after a
  rollback), and refetches right after an event could miss the change.
- **Cause:** publishing to Redis before the database transaction committed.
- **Fix:** always commit to Postgres, then publish. `backend/app/calls.py` records changes, commits
  and only then flushes events; message routes follow the same order.

### Rotating SECRET_KEY breaks AI
- **Problem:** after changing `SECRET_KEY`, workspace AI showed "not configured".
- **Cause:** workspace AI keys are encrypted with a key derived from `SECRET_KEY`
  (`backend/app/ai/keys.py`). A new secret cannot decrypt old keys. Everyone is also signed out,
  because JWTs are signed with the same secret.
- **Fix:** this is by design. Keep `SECRET_KEY` stable; if you must rotate it, tell admins to
  re-enter their AI keys in Workspace settings → AI.

## Infrastructure

### SeaweedFS accepted unsigned requests
- **Problem:** the local S3 service accepted requests with no credentials at all, which hid
  misconfigured keys until production.
- **Cause:** SeaweedFS S3 allows anonymous access unless an identities config is supplied.
- **Fix:** `docker-compose.yml` starts SeaweedFS with `-s3.config=/etc/seaweedfs/s3.json`, mounted
  from `infra/seaweedfs/s3.json`. Its credentials must match `S3_ACCESS_KEY` / `S3_SECRET_KEY`.

### Redis port clash
- **Problem:** `make up` failed, or the API talked to the wrong Redis.
- **Cause:** port 6379 is often already used by a Redis installed on the host.
- **Fix:** Compose publishes Redis on host port `6380` (`"6380:6379"`). Inside Compose, services
  still use `redis:6379`. When running the API on the host, use `redis://localhost:6380/0`.

### Reminders never fired
- **Problem:** reminders and scheduled messages were saved but never delivered, with no errors.
- **Cause:** the `beat` service was defined but not started, so no periodic tasks ran. The worker
  alone does not schedule anything.
- **Fix:** run beat. `make up` starts every service in `docker-compose.yml`, including `beat`. In
  production, run exactly one beat process next to your workers. Jobs are listed in
  `backend/app/workers/celery_app.py`.

### LiveKit unreachable from the browser
- **Problem:** browsers on the host could not get media to or from LiveKit running in Docker.
- **Cause:** inside Docker, LiveKit advertised its container IP as the ICE candidate, which the
  browser on the host cannot reach.
- **Fix:** run LiveKit with `--node-ip 127.0.0.1` for local development (see `docker-compose.yml`)
  and publish `7880`, `7881` and `7882/udp`. In production set the public IP and use TLS.

## Testing

### Two accounts in one browser
- **Problem:** testing calls and realtime needs two signed-in users at once.
- **Cause / opportunity:** the auth token is stored in `localStorage` (`frontend/src/lib/api.ts`),
  which is separate for each origin.
- **Fix:** open `http://localhost:3000` and `http://127.0.0.1:3000` side by side and sign in as a
  different user in each. Add both to `CORS_ORIGINS` and the second host to `NEXT_DEV_ALLOWED_ORIGINS`.
  See [CONTRIBUTING.md](/docs/contributing/#testing-with-two-accounts-in-one-browser).

## Working with AI coding agents

Much of Worklio was built with AI coding agents working in parallel. What worked:

- **Problem:** parallel agents overwrote each other's changes or produced merge conflicts.
  **Cause:** overlapping files. **Fix:** give each agent a disjoint list of files it owns. Shared
  registries (for example `backend/app/models/__init__.py`, `backend/app/main.py`) get
  append-only sections so additions merge cleanly.
- **Problem:** agents quietly narrowed or changed their task when they saw unrelated messages
  mid-run. **Cause:** no single source of truth for scope. **Fix:** state an explicit, authoritative
  scope rule at the top of each task and say that later chat messages do not change it.
- **Problem:** items were reported as finished when they were only partly done. **Fix:** require a
  DONE / NOT DONE line for every item, plus the checks that were run.
- **Problem:** gaps between agents' work. **Fix:** one integrator reviews everything, runs the full
  checks and the live two-account test, and finishes what was missed.
