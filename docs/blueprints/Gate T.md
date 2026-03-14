<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Lets expand on this into a dev plan and for starters we are going to use a shared server, with c-panel and node.js app install capabilities, also has database capabilities and domain and dns management:

T — Project \& Task Management: Expand the existing dashboard into a full project board with tasks, assignees, due dates, and status columns. Clients manage their business operations without leaving the platform

For Phase T on your shared cPanel stack, build a **lightweight projects + tasks module** inside the existing Node backend and React dashboard, using a Kanban-style board similar to your CRM pipeline and dashboard builder.

***

## 1. Scope for v1

- **Projects**: containers for work (per tenant).
- **Tasks**: items with title, assignee, status, due date, links to CRM deals/contacts if needed.
- **Board views**:
    - Kanban by status (To Do, In Progress, Blocked, Done).
    - Optional list/calendar view later.
- **Basic collaboration**:
    - Assign tasks to users.
    - Comments/activity log.

Everything is tenant-scoped, consistent with your existing architecture.

***

## 2. Data model (DB on shared host)

Add tables:

- `projects`
    - `id`
    - `tenant_id`
    - `name`
    - `description`
    - `status` (`active`, `archived`)
    - `owner_user_id`
    - `start_date`, `end_date`
    - timestamps
- `project_columns` (for Kanban columns per project)
    - `id`
    - `project_id`
    - `name` (`Backlog`, `In Progress`, `Done`, etc.)
    - `order_index`
    - `is_default_done` (for completion)
    - timestamps
- `tasks`
    - `id`
    - `tenant_id`
    - `project_id`
    - `title`
    - `description`
    - `status_column_id` (FK to `project_columns`)
    - `assignee_user_id` (nullable)
    - `priority` (`low`, `medium`, `high`)
    - `due_date` (nullable)
    - `linked_crm_deal_id` (nullable, ties to Phase S)
    - timestamps
- `task_comments`
    - `id`
    - `task_id`
    - `tenant_id`
    - `author_user_id`
    - `content`
    - timestamps

These models mirror common SaaS project boards; they are simple to query and extend.

***

## 3. Backend APIs (Node on cPanel)

Under `/api/projects` and `/api/tasks`:

- Projects:
    - `GET /projects`
    - `POST /projects`
    - `GET /projects/:id`
    - `PUT /projects/:id`
    - `DELETE /projects/:id` (or archive)
    - `GET /projects/:id/columns`
    - `PUT /projects/:id/columns` (reorder, rename, add/remove)
- Tasks:
    - `GET /projects/:id/tasks` (with filters: assignee, due, status).
    - `POST /projects/:id/tasks`
    - `GET /tasks/:id`
    - `PUT /tasks/:id`
    - `PATCH /tasks/:id/move` (change column and optional order)
    - `POST /tasks/:id/comments`
    - `GET /tasks/:id/comments`

All routes:

- Use existing auth/tenant middleware to enforce `tenant_id`.
- Are RBAC-protected (e.g. `projects.view`, `projects.edit`).

***

## 4. Dashboard UI: Kanban board and task views

In the React dashboard, add a **“Projects”** section:

- **Projects list**:
    - Cards or table of projects with status, owner, progress (e.g. % tasks done).
- **Project board view** (per project):
    - Columns from `project_columns`.
    - Tasks rendered as cards with:
        - Title.
        - Assignee avatar.
        - Due date and priority.
    - Drag-and-drop to move tasks between columns (reuse the drag library used in dashboard builder if possible).
- **Task detail drawer**:
    - Opens when clicking a card.
    - Shows full description, comments, activity, linked CRM deal/contact (optional).
    - Allows changing assignee, due date, status, and adding comments.

This delivers a familiar Trello/Jira-lite experience but integrated into AIISTECH.

***

## 5. Integrations with other modules

- **CRM** (Phase S):
    - Allow linking tasks to CRM deals or contacts (`linked_crm_deal_id`), so teams can track activities around specific sales opportunities.
- **Automations** (Phase N):
    - Later, triggers like:
        - “When a deal moves to ‘Proposal’, create a project.”
        - “When a task is overdue, send an email/slack webhook.”
- **AI** (Phase P/R):
    - “AI, summarize this project’s tasks and risks.”
    - “Draft an update for stakeholders on this project.”

All reuse your existing services; project tasks become another first-class object to plug into automations and AI.

***

## 6. Multi-tenant \& shared-server constraints

- All queries filtered by `tenant_id`, with indexes on `(tenant_id, project_id)` for performance.
- No extra infrastructure needed: just Node + DB + existing auth.
- For notifications, start with email via your existing SMTP/provider; in-app notifications can come later.

***

## 7. Milestones

1. **T1 – Core models \& APIs**
    - Implement tables and REST endpoints for projects, columns, tasks, comments.
2. **T2 – Project board UI**
    - Projects list + single-project Kanban board with drag-and-drop.
    - Basic task detail drawer.
3. **T3 – Collaboration \& UX**
    - Comments, assignee selection, due dates.
    - Filters (by assignee, due soon, status).
4. **T4 – Cross-module links**
    - Link tasks to CRM deals/contacts.
    - Optional automation triggers for key events.

On your current AIISTECH shared-server setup, T1–T2 give immediate operational value, with later phases wiring it into CRM, automation, and AI.

