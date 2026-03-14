<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Lets expand on this into a dev plan and for starters we are going to use a shared server, with c-panel and node.js app install capabilities, also has database capabilities and domain and dns management:

N — Webhook \& Automation Engine: Build a trigger-action automation system (similar to Zapier's model). Use Bull/BullMQ with Redis for async job queues. The automations and processes dashboard routes are already wired to live APIs

On a shared cPanel server, Phase N should start as a **single-process automation engine** inside your Node backend, with a clean trigger–action model and a pluggable queue abstraction that can later move to Bull/BullMQ+Redis when you add that infrastructure.[^1][^2][^3]

***

## 1. Scope: what “automations” mean in AIISTECH

Use a Zapier-like mental model: every automation is a **workflow** with:

- One **trigger** (event): e.g. “New lead created”, “Invoice paid”, “Form submitted”, “Webhook received”.[^4][^5][^6]
- One or more **actions**: e.g. “Send email”, “Create QuickBooks invoice”, “Enqueue bot run”, “Create task”.[^6][^4]

You already have `automations` and `processes` routes in the dashboard wired to live APIs, so the goal here is to back those views with a real workflow model and execution engine rather than mock data.

***

## 2. Data model (DB on shared host)

Add core tables:

- `automation_workflows`
    - `id`
    - `tenant_id`
    - `name`
    - `is_enabled`
    - `trigger_type` (e.g. `webhook`, `schedule`, `event:invoice.paid`)
    - `trigger_config` (JSON: webhook secret, schedule cron, filters)
    - `created_by_user_id`
    - timestamps
- `automation_actions`
    - `id`
    - `workflow_id`
    - `order_index` (for multi-step sequences)
    - `action_type` (e.g. `send_email`, `call_webhook`, `create_task`, `run_bot`)
    - `action_config` (JSON: targets, templates, mappings)
    - timestamps
- `automation_runs`
    - `id`
    - `workflow_id`
    - `tenant_id`
    - `status` (`pending`, `running`, `succeeded`, `failed`)
    - `trigger_payload` (JSON snapshot)
    - `started_at`, `finished_at`
    - `error_message`
- `automation_run_actions`
    - `id`
    - `run_id`
    - `action_id`
    - `status`
    - `output` (JSON)
    - timestamps

This matches common trigger–action workflow platforms: a workflow definition table, action steps, and run/run-step logs.[^7][^8][^4][^6]

***

## 3. Triggers on a shared server

Start with 2–3 trigger types that don’t require extra infra:

1. **Inbound webhook trigger** (`trigger_type='webhook'`)
    - Public endpoint: `POST /api/hooks/:workflowId` or better `POST /api/hooks/:tenantKey/:workflowKey`.
    - Validates a secret or HMAC in headers.
    - Creates an `automation_runs` row and queues an execution job.
2. **Internal event trigger**
    - From inside your app: when something happens (e.g. project deployed, new contact created), call an internal `automationEngine.emit('event', { type, tenantId, payload })`.
    - The engine finds workflows with `trigger_type='event:*'` and enqueues runs.
3. **Scheduled trigger** (optional early)
    - Use a simple `setInterval`/cron-like job in the Node app to scan for workflows with schedule configs.
    - On shared hosting, you can use cPanel’s cron to hit a “scheduler” endpoint every minute and let the backend schedule runs.

This keeps phase-one triggers fully feasible without Kafka or external schedulers, while aligning with how Zapier triggers work conceptually (webhooks and polling-based triggers).[^5][^4][^6]

***

## 4. Queue and execution layer

On cPanel, you may not have Redis initially, so design the execution engine with a **queue abstraction**:

- Start with a DB-backed queue or simple “immediate” execution:
    - On trigger, insert `automation_runs` and immediately process actions in the same process (with basic concurrency limits).
- Add an abstraction:

```ts
interface JobQueue {
  enqueueRun(runId: string): Promise<void>;
}

class InlineQueue implements JobQueue {
  async enqueueRun(runId: string) {
    // process immediately
    await executeRun(runId);
  }
}
```

Later, when you can add Redis, plug in Bull/BullMQ instead of `InlineQueue`:

- Use BullMQ’s `Queue` + `Worker` patterns, backed by Redis, for background job processing, retries, and delayed jobs.[^9][^2][^3][^1]
- Your code doesn’t change; only the queue implementation does.

This follows best practice: design around an internal queue interface, use BullMQ when infra allows it, rely on DB-backed or in-process execution while you’re purely on shared hosting.[^2][^3][^1]

***

## 5. Action executors

Implement a small **action registry**:

- Supported actions v1:
    - `send_email` (via SMTP or a provider).
    - `call_webhook` (HTTP POST).
    - `log_event` (for debugging).
    - Later: `create_quickbooks_invoice`, `add_mailchimp_subscriber`, `run_bot_process`, etc.

Action interface:

```ts
type ActionExecutor = (config: any, context: { tenantId; payload; runId }) => Promise<ActionResult>;
```

- Look up actions by `action_type`.
- Pass trigger payload and tenant context into each action for mapping.

Use patterns from integration-engine and multi-tenant automation articles: keep action implementations stateless functions that rely on config and tenant integrations (OAuth tokens) to call external APIs.[^10][^11]

***

## 6. Webhook delivery (outbound) \& reliability

For actions like `call_webhook`, adopt standard webhook best practices:

- **Retries** with exponential backoff for non-2xx responses.
- **Signing** outbound webhooks with a shared secret, so downstream systems can verify authenticity (HMAC signatures in headers).[^12]
- **Rate limiting** per tenant or per endpoint to avoid overwhelming downstream services.[^12]

Even with in-process queues, you can implement simple retry schedules (e.g. immediate, +1min, +5min) stored in DB and picked up by a cron-triggered worker in Node.

***

## 7. UI in the AIISTECH dashboard

You already have `automations` and `processes` routes wired to live APIs.  Turn those into:

- **Automations list**:
    - Show workflows with status, type, last run, error badges.
- **Automation editor** (v1, form-based, not visual graph yet):
    - Choose trigger type (webhook, app event).
    - Configure filters, payload mapping.
    - Add one or more actions in order, with config forms per action type.
- **Runs view**:
    - For a selected workflow, list recent runs (status, started/finished times).
    - Drill-down to each action’s result and error message.

Over time you can add a React Flow–style visual automation editor, but a form-based step list is enough initially.

***

## 8. Multi-tenant \& RBAC

- Scope workflows and runs by `tenant_id` in all queries (using your tenant context middleware from earlier phases).[^13][^10]
- Only allow users with `automations.manage` permission to create/update workflows; others can view or run them manually.
- Ensure triggers/events never cross tenant boundaries: internal events must always carry `tenantId` and automation lookup must filter by tenant.

This aligns with multi-tenant integration best practices: tenant-aware data management and strict isolation in automation pipelines.[^11][^10]

***

## 9. Milestones

1. **N1 – Core model \& inline engine**
    - Tables: workflows, actions, runs, run_actions.
    - Inline queue implementation with simple webhook trigger.
2. **N2 – UI and webhook triggers**
    - Integrations in `automations` route to create/edit workflows.
    - Public inbound webhooks to start runs.
3. **N3 – Internal events \& logs**
    - Emit internal events from your app (e.g. project deployed, billing event).
    - Route them through the engine and show runs in UI.
4. **N4 – Queue swap to Bull/BullMQ (when Redis is available)**
    - Implement BullMQ-backed `JobQueue` for background processing, retries, and scheduled jobs.[^14][^3][^1][^2]

On your current shared-server AIISTECH setup, N1–N3 are fully achievable with Node + SQL alone, while designing the queue abstraction so BullMQ+Redis can be added later without rewiring the workflow engine.
<span style="display:none">[^15][^16][^17][^18][^19][^20]</span>

<div align="center">⁂</div>

[^1]: https://oneuptime.com/blog/post/2026-01-21-bullmq-vs-other-queues/view

[^2]: https://judoscale.com/blog/node-task-queues

[^3]: https://lirantal.com/blog/how-to-process-scheduled-queue-jobs-in-nodejs-with-bullmq-and-redis-on-heroku

[^4]: https://www.linkedin.com/learning/programming-no-code-integrations-with-zapier/understand-zaps-triggers-actions-and-tasks

[^5]: https://docs.zapier.com/platform/build/trigger

[^6]: https://docs.zapier.com/platform/quickstart/recommended-triggers-and-actions

[^7]: https://github.com/idityaGE/_zapier

[^8]: https://github.com/rakeshkanneeswaran/Zapier

[^9]: https://github.com/taskforcesh/bullmq-redis/blob/main/README.md

[^10]: https://www.lmsportals.com/post/building-multi-tenant-saas-for-ai-workloads-lessons-from-modern-learning-platforms

[^11]: https://dev.to/genesis_technologies/building-scalable-multi-tenant-integrations-lessons-from-real-world-saas-projects-43cl

[^12]: https://www.bugfree.ai/knowledge-hub/multi-tenant-webhook-architecture

[^13]: https://github.com/lanemc/multi-tenant-saas-toolkit

[^14]: https://github.com/taskforcesh/bullmq

[^15]: https://github.com/dagster-io/dagster/issues/8096

[^16]: https://github.com/taskforcesh/bullmq-redis

[^17]: https://github.com/javaid-dev/multi-tenant-saas-platform

[^18]: https://github.com/juicycleff/ultimate-backend

[^19]: https://github.com/zapier/zapier-platform-example-app-trigger/actions

[^20]: https://www.youtube.com/watch?v=JtdUgJGI_Oo

