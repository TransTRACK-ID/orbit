# Orbit

Orbit is a project management platform that blends traditional kanban task tracking with **AI agent orchestration**. It helps teams move from static task lists to dynamic, agent-assisted workflows where tasks can be assigned to AI agents that process them automatically.

## What It Is

At its core, Orbit is a project manager's workshop: organized, well-lit, and purposeful. It provides:

- **Kanban Boards** — Visual task tracking with columns, drag-and-drop, and clear status visibility.
- **AI Agent Integration** — Assign tasks to AI agents that can execute, research, or generate code automatically.
- **Workspace & Project Management** — Organize work across multiple workspaces and projects with hierarchical structure.
- **Agent Activity Monitoring** — See what each agent is working on in real-time, with context sharing across tasks to prevent duplicate work.
- **PRD & Brainstorm Tools** — Built-in support for product requirement documents and AI-assisted brainstorming sessions.
- **Pull Request Tracking** — Connect tasks to code changes and monitor review status.

## Who It's For

Project managers and team leads who oversee software development teams. Orbit is designed for desktop use, supports multiple projects, and is optimized for frequent context-switching between boards, settings, and agent panels.

## Tech Stack

- **Frontend**: Nuxt 3 (Vue 3), Tailwind CSS, TipTap editor
- **Backend**: Nuxt server, Drizzle ORM, PostgreSQL
- **Auth**: JWT-based credentials auth via `@sidebase/nuxt-auth`
- **Design**: Warm, approachable UI with a terracotta accent, Montserrat typography, and full dark mode support

## Philosophy

- **Clarity over density** — Every screen answers "what needs my attention?" in under 3 seconds.
- **Agent presence is ambient** — AI agents feel like helpful colleagues, not intrusive robots.
- **Warm precision** — Sharp enough for power users, warm enough for daily use.

## Key Pages

- `/` — Dashboard with project overview and kanban boards
- `/agents` — Agent management and activity monitoring
- `/admin` — System administration
- `/settings` — User preferences and workspace settings
- `/login`, `/register` — Authentication
- `/onboarding` — First-time user setup
