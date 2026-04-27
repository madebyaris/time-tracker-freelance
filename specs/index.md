# SDD Features Index

## Navigation

- [Project Overview](00-overview.md)
- [Agent Manual](../.cursor/commands/_shared/agent-manual.md)

## Feature Status Dashboard

### Active Features (In Development)

| Task ID | Feature | Status | Created |
|---------|---------|--------|---------|
| *none* | — | — | — |

### Completed Features

| Task ID | Feature | Completed |
|---------|---------|-----------|
| ttf-001 | [Tickr — time tracker](active/ttf-001/spec.md) | 2026-04-24 |
| ttf-002 | [Richer clients + Claude-style tray timer](active/ttf-002/feature-brief.md) | 2026-04-27 |
| ttf-003 | [Invoice PDF export + branded invoice profile](active/ttf-003/feature-brief.md) | 2026-04-27 |
| ttf-004 | [Cloudflare deployability + web auth hardening](active/ttf-004/feature-brief.md) | 2026-04-27 |

### Backlog Features

| Task ID | Feature | Priority |
|---------|---------|----------|
| *none* | — | — |

## Quick Actions

- Create new feature: `/brief [task-id] [description]`
- Full project roadmap: `/sdd-full-plan [project-id] [description]`
- View active specs: `specs/active/`
- View roadmaps: `specs/todo-roadmap/`

## How Specs Are Created

Each command writes to `specs/active/[task-id]/`:

| Command | Creates |
|---------|---------|
| `/brief` | `feature-brief.md` |
| `/research` | `research.md` |
| `/specify` | `spec.md` |
| `/plan` | `plan.md` |
| `/tasks` | `tasks.md` |
| `/implement` | `todo-list.md` + code |
| `/evolve` | Updates existing spec files |
| `/audit` | Audit report (in chat, not saved) |

Project roadmaps go to `specs/todo-roadmap/[project-id]/`.

---
**Version:** SDD 5.0
