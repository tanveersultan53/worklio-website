---
title: Roadmap
description: What's next for Worklio.
---

This is a short view of what comes next. The detailed feature list, with status per feature, is in
[PRODUCT_BLUEPRINT.md](https://github.com/tanveersultan53/worklio/blob/main/docs/PRODUCT_BLUEPRINT.md). Plans change; open an issue if you want to work on
something here or propose something new (see [CONTRIBUTING.md](/docs/contributing/)).

## Next

**Scale for very large workspaces** (Pagination v2 shipped: stable cursors, jump to any message,
reconnect gap-fill, paged threads and search)
- Virtualize the message list.
- Paginate member and channel lists.

**Reach people outside the open tab**
- Web push notifications (service worker + VAPID) for messages, calls and huddles.
- Installable PWA with an offline shell.
- Email invitations and email digests.

**Meetings**
- Huddle recording (LiveKit egress → Files).
- Scheduled meetings and calendar (ICS invites).

**Quality**
- Playwright end-to-end suite covering two-account flows.
- Performance work (large channels, long threads) and a Lighthouse pass.
- Accessibility audit (keyboard, screen readers, contrast).

## Later

- Desktop app (Tauri) and mobile apps.
- Webhooks, bot tokens and an app framework.
- SSO/SAML and SCIM.
- Internationalisation.
