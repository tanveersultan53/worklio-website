---
title: Quick start
description: Run Worklio on your machine with Docker in about five minutes.
---

You need **Docker** (with Compose), **Node.js 22** and **make**.

## 1. Get the code

```bash
git clone https://github.com/tanveersultan53/worklio.git
cd worklio
cp .env.example .env
```

The example settings work as-is for local use.

## 2. Start the backend

```bash
make up
```

This starts Postgres, Redis, S3-compatible storage, the API, background workers, the scheduler and LiveKit (for calls). The API runs its database migrations on start. Check it at [http://localhost:8000/health](http://localhost:8000/health).

## 3. Start the web app

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), choose **Create an account**, and create your first workspace.

## 4. Invite a teammate

Go to **Workspace settings → Invitations**, create an invite link, and open it in another browser (or a private window) to join as a second person. Two people make it easy to try calls, threads and live editing.

## Optional: turn on Worklio AI

Worklio AI is off until you add a provider key. As a workspace admin, open **Workspace settings → AI**, pick Anthropic, Gemini or DeepSeek, and paste your key there. It's stored encrypted and never shown again. You can also set `ANTHROPIC_API_KEY` in `.env`.

## Optional: a demo workspace

To see Worklio full of realistic content, seed the demo workspace with fictional people:

```bash
python3 scripts/seed_demo.py /tmp/worklio-demo.json
```

The JSON file contains the demo logins.

## Where next

- [Deploy to production](/docs/self-hosting/deployment/)
- [Configuration reference](/docs/self-hosting/configuration/)
- [How to contribute](/docs/contributing/)
