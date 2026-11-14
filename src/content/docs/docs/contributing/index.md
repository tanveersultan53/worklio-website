---
title: How to contribute
description: Set up Worklio locally, run the checks and open a pull request.
---

Thanks for helping. This guide covers setup, the checks we run, and what a good pull request
looks like. By taking part you agree to follow the [Code of Conduct](https://github.com/tanveersultan53/worklio/blob/main/CODE_OF_CONDUCT.md). Roles
(contributor, triager, maintainer) and how decisions are made are described in
[GOVERNANCE.md](/docs/contributing/governance/).

## Ways to help

- Fix a bug or pick an issue labelled `good first issue` or `help wanted`. The pinned
  [Roadmap issue](https://github.com/tanveersultan53/worklio/issues/24) lists what's ready.
- Work on something from [docs/ROADMAP.md](/docs/contributing/roadmap/). Open an issue first so we can agree
  on the approach before you write a lot of code.
- Improve docs, tests or accessibility.
- Report bugs with clear steps to reproduce.

To pick an issue, comment on it to ask for it and a maintainer will assign it to you. Please take
one issue at a time. If an assigned issue has no activity for two weeks, it may be reassigned. For larger changes (new features, schema changes, new dependencies), open an issue
or draft PR early.

Security problems are the exception: never open a public issue. Follow [SECURITY.md](/docs/self-hosting/security/).

## Development setup

Prerequisites: Docker with Compose, Node.js 22, npm, and `make`.

```bash
cp .env.example .env
make up                                   # postgres, redis, s3, api, worker, beat, livekit
cd frontend && npm install && npm run dev # http://localhost:3000
```

The API runs migrations on start and reloads on code changes (`backend/` is mounted into the
container). Run `make logs` to watch the API and worker. See [backend/README.md](https://github.com/tanveersultan53/worklio/blob/main/backend/README.md)
and [frontend/README.md](https://github.com/tanveersultan53/worklio/blob/main/frontend/README.md) for package-level details, and
[docs/CONFIGURATION.md](/docs/self-hosting/configuration/) for settings.

## Branches and commits

Branch from `main` and use a short prefix:

- `feat/<topic>` new feature
- `fix/<topic>` bug fix
- `docs/<topic>` documentation only
- `refactor/<topic>`, `test/<topic>`, `chore/<topic>`

Write commit messages in [Conventional Commits](https://www.conventionalcommits.org/) style:

```
feat(calls): show a missed-call card in the DM
fix(canvas): skip autosave when the document is unchanged
docs: explain LiveKit production keys
```

Common types: `feat`, `fix`, `docs`, `refactor`, `test`, `perf`, `chore`, `ci`. The scope is
optional. Keep the subject under about 72 characters and explain the "why" in the body when it
is not obvious.

## How changes get merged

You don't need write access. The usual flow:

1. **Fork** the repository and create a branch from `main` (names above).
2. Make your change, run the [checks](#checks), and push to your fork.
3. **Open a pull request** against `main`. Fill in the template and link the issue with
   `Closes #123`. Open it as a draft if you want early feedback.
4. **CI runs** on every push. Both checks must pass: *Backend (ruff + pytest)* and
   *Frontend (tsc + lint + build)*. First-time contributors' CI runs start after a maintainer
   approves them.
5. **Review:** a code owner reviews the PR. Pushing new commits after an approval dismisses it,
   so the final version is always the reviewed one. Resolve every review conversation.
6. **Merge:** a maintainer squash-merges the PR, so the PR title becomes the commit on `main`.
   Use a [Conventional Commits](https://www.conventionalcommits.org/) style title.

`main` is protected by a ruleset: nobody, maintainers included, can push to it directly, force
push or delete it. See [GOVERNANCE.md](/docs/contributing/governance/#how-changes-reach-main) for the full rules.

A DCO sign-off is not required. By submitting a contribution you agree that it is licensed under
the project's [MIT License](https://github.com/tanveersultan53/worklio/blob/main/LICENSE).

## Database migrations

Models live in `backend/app/models/`. After changing a model:

```bash
make revision m="add pinned_at to messages"   # autogenerate into backend/alembic/versions/
make migrate                                  # apply it
```

- Read the generated file before committing. Autogenerate misses some things (enum changes,
  server defaults, data migrations, extensions) and sometimes adds noise.
- **Keep a single head.** Before opening a PR, check `docker compose exec api alembic heads` prints
  exactly one revision. If `main` gained a migration since you branched, rebase and set your
  migration's `down_revision` to the new head. Prefer this over adding a merge migration.
- Migrations must be reversible where practical (`downgrade()` implemented).

## Checks

Run these before pushing. CI runs the same ones (see `.github/workflows/ci.yml`).

**Backend** (with the stack running):

```bash
docker compose exec api ruff check app tests
make test                                     # pytest inside the api container
```

Tests use the stack's Postgres, Redis and S3. Every new endpoint needs tests, including a
tenant-isolation test (a non-member gets `404`).

**Frontend:**

```bash
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

## Quality bar

From [docs/PRODUCT_BLUEPRINT.md](https://github.com/tanveersultan53/worklio/blob/main/docs/PRODUCT_BLUEPRINT.md), every user-facing change should meet
this bar:

- **Live two-account browser test** of the flow you changed (messages, calls, realtime updates).
- Backend: pytest for every endpoint including tenant isolation; ruff clean; Alembic in sync.
- Frontend: strict TypeScript, React Compiler lint clean, no hydration warnings, works in dark
  mode, works at 360 px wide, usable with keyboard and screen reader.

### Testing with two accounts in one browser

The auth token is stored in `localStorage`, which is per origin. So two origins give you two
independent sessions side by side:

1. Add both origins to `CORS_ORIGINS` in `.env` (matching is exact):
   `CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`, then `docker compose up -d api`.
2. Make sure the second host is in `NEXT_DEV_ALLOWED_ORIGINS` in `frontend/.env.local` (comma-separated; it feeds `allowedDevOrigins` in `frontend/next.config.ts`)
   (`127.0.0.1` is already there). Next.js blocks dev assets for hosts not listed.
3. Sign in as user A at http://localhost:3000 and as user B at http://127.0.0.1:3000.

For calls, both tabs need camera/microphone permission. LiveKit runs locally on port 7880.

## Pull request checklist

- [ ] The PR does one thing and explains why.
- [ ] Backend: `ruff check app tests` and `make test` pass; new endpoints have tests incl. tenant isolation.
- [ ] Migrations: generated file reviewed, single Alembic head.
- [ ] Frontend: `npx tsc --noEmit`, `npm run lint` and `npm run build` pass.
- [ ] Live-tested with two accounts where relevant; checked dark mode and a narrow window.
- [ ] Docs updated (README, `docs/CONFIGURATION.md` for new settings, `.env.example`, CHANGELOG under "Unreleased").
- [ ] No secrets, real keys or personal data in code, tests, screenshots or logs.

## Code conventions

- Tenant isolation goes through the dependencies in `backend/app/api/deps.py`. Never query
  workspace data without them. Non-members get `404`, not `403`.
- Commit to Postgres first, then publish the realtime event to Redis.
- Gate admin-controlled actions with `require_policy` and record admin actions with
  `record_audit` (`backend/app/admin.py`). Never put secrets in audit metadata.
- Frontend: read [frontend/README.md](https://github.com/tanveersultan53/worklio/blob/main/frontend/README.md) and
  [docs/LESSONS_LEARNED.md](/docs/contributing/lessons-learned/) before touching Base UI menus, external
  stores or hydration-sensitive code.

## Using AI coding agents

AI assistants are fine to use. You are responsible for every line you submit: read it, run the
checks and do the live test. When running several agents in parallel, give each a disjoint set of
files and a clear scope, and ask for a per-item done/not-done report. See
[docs/LESSONS_LEARNED.md](/docs/contributing/lessons-learned/#working-with-ai-coding-agents).
