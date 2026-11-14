---
title: Governance and roles
description: Roles in the project, how decisions are made and how changes reach main.
---

Worklio is an open-source project led by its maintainers and shaped by its contributors. This
document explains the roles in the project, what each role can do, how people move between roles,
and how decisions are made.

## Roles

| Role | Who | What they can do | GitHub permission |
|---|---|---|---|
| **User** | Anyone using Worklio | Report bugs, request features, join Discussions | None needed |
| **Contributor** | Anyone who has opened an issue or pull request | Everything a user can, plus propose changes through pull requests from a fork | None needed (fork) |
| **Triager** | Trusted contributors who help keep issues tidy | Label, assign and close issues and PRs, mark duplicates, request more information | Triage |
| **Maintainer** | Contributors with a sustained record of good work in an area | Review and approve pull requests in their area, push branches to this repository, guide design decisions | Write |
| **Lead maintainer** | [@tanveersultan53](https://github.com/tanveersultan53) | Final approval for everything that lands in `main`, releases, repository settings, security responses, and adding or removing maintainers | Admin |

### Users and contributors

You don't need permission to contribute. Fork the repository, make your change on a branch, and
open a pull request. Read [How to contribute](/docs/contributing/) first; it covers setup, checks and the
pull request checklist. The pinned [Roadmap issue](https://github.com/tanveersultan53/worklio/issues/24)
lists work that is ready to pick up.

### Triagers

Triagers keep the issue tracker useful:

- Apply labels (`area: …`, `good first issue`, `help wanted`, `needs triage`) and close duplicates.
- Ask reporters for missing details and reproduce bugs when they can.
- Assign issues to contributors who ask for them.

Triagers don't merge code.

### Maintainers

Maintainers review pull requests in the areas they know (for example `area: calls` or
`area: frontend`), approve them when they're ready, and help contributors get there. A maintainer
approval counts toward the review requirement once the lead maintainer adds them to
[`.github/CODEOWNERS`](https://github.com/tanveersultan53/worklio/blob/main/.github/CODEOWNERS) for that area.

### Lead maintainer

The lead maintainer has the final say on what merges into `main` and owns releases, repository
settings and security handling. While Worklio has a single lead maintainer, every change to `main`
needs their approval (see [How changes reach `main`](#how-changes-reach-main)).

## Becoming a triager or maintainer

There's no application form. Roles follow sustained, visible work:

- **Triager:** a few weeks of helpful activity in issues and Discussions (reproducing bugs,
  answering questions, suggesting labels). A maintainer nominates you in a Discussion.
- **Maintainer:** several merged pull requests in an area, good reviews of other people's work,
  and following the [Code of Conduct](https://github.com/tanveersultan53/worklio/blob/main/CODE_OF_CONDUCT.md). A maintainer nominates you; the lead
  maintainer decides.

Roles can be stepped down from at any time. Maintainers who are inactive for six months move to
emeritus status and can return by asking.

## How changes reach `main`

`main` is protected by a repository ruleset. Nobody, including the lead maintainer, pushes to it
directly:

1. Every change arrives as a pull request.
2. Both CI checks must pass on a branch that is up to date with `main`:
   **Backend (ruff + pytest)** and **Frontend (tsc + lint + build)**.
3. A code owner must approve. New commits after an approval dismiss it, and the most recent push
   must be approved by someone other than its author.
4. All review conversations must be resolved.
5. Pull requests are squash-merged, so `main` has a linear history with one commit per change.
6. Force pushes and deleting `main` are blocked.

Release tags (`v*`) can only be created, moved or deleted by admins.

## Decision making

- **Day-to-day changes** are decided in pull request review.
- **Larger changes** (new features, data model changes, new dependencies, breaking API changes)
  start as an issue or a Discussion so the approach is agreed before code is written.
- We aim for consensus. When it isn't reached, the lead maintainer decides and explains why in
  the issue or Discussion.

## Code of Conduct and security

Everyone in the project follows the [Code of Conduct](https://github.com/tanveersultan53/worklio/blob/main/CODE_OF_CONDUCT.md). Security
vulnerabilities are reported privately as described in [Security](/docs/self-hosting/security/), never in public
issues.

## Changes to this document

Changes to governance go through a pull request like any other change, and need the lead
maintainer's approval.
