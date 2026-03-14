<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Lets expand on this into a dev plan and for starters we are going to use a shared server, with c-panel and node.js app install capabilities, also has database capabilities and domain and dns management:

Phase S–U: Business Operations Modules
S — CRM Module: Build a lightweight client/contact management system with pipeline views. Connect to third-party CRMs (HubSpot, Salesforce) via the integrations hub from Phase M

For Phase S on your shared cPanel stack, start with a **native, lightweight CRM** implemented in your existing Node backend and React dashboard, then layer HubSpot/Salesforce sync on top via the integrations hub from Phase M.[^1][^2]

***

## 1. Scope of the first CRM module

Goals for v1:

- **Contacts**: store people/companies with basic fields.
- **Deals/Pipeline**: represent opportunities in stages (Kanban view).
- **Activities**: log calls/emails/notes associated with contacts and deals.
- **Views** in the dashboard:
    - Contacts table.
    - Pipeline board.
    - Deal detail pane.

Integration with third-party CRMs (HubSpot, Salesforce) comes after this core is stable, using the OAuth integrations you’re already planning.[^2][^1]

***

## 2. Data model (multi-tenant, shared DB)

Add (or Prisma models equivalent):

- `crm_contacts`
    - `id`
    - `tenant_id`
    - `first_name`, `last_name`
    - `email`, `phone`
    - `company_name`
    - `job_title`
    - `owner_user_id` (assigned internal owner)
    - `source` (web form, import, integration)
    - `lifecycle_stage` (lead, MQL, SQL, customer)
    - timestamps
- `crm_deals`
    - `id`
    - `tenant_id`
    - `contact_id` (primary contact)
    - `name`
    - `amount`
    - `currency`
    - `stage_id` (FK into pipeline stages)
    - `close_date`
    - `owner_user_id`
    - `source` (direct, HubSpot, Salesforce, etc.)
    - timestamps
- `crm_stages`
    - `id`
    - `tenant_id`
    - `pipeline_name` (e.g. “Sales”, “Onboarding”)
    - `name` (e.g. “New”, “Qualified”, “Proposal”, “Closed Won”, “Closed Lost”)
    - `order_index`
    - `is_closed_won`, `is_closed_lost`
- `crm_activities`
    - `id`
    - `tenant_id`
    - `type` (`note`, `call`, `meeting`, `email`)
    - `contact_id` (nullable)
    - `deal_id` (nullable)
    - `content` (text/JSON)
    - `created_by_user_id`
    - timestamps

Every table is tenant-scoped, aligning with your existing multi-tenant patterns.[^3][^1]

***

## 3. Backend APIs (Node on cPanel)

Under `/api/crm`:

- Contacts:
    - `GET /contacts` (with filters, pagination).
    - `POST /contacts` (create).
    - `GET /contacts/:id`.
    - `PUT /contacts/:id`.
    - `DELETE /contacts/:id`.
- Deals \& pipeline:
    - `GET /deals` (with filters: stage, owner, date range).
    - `POST /deals`.
    - `PUT /deals/:id`.
    - `PATCH /deals/:id/stage` (for Kanban drag-and-drop).
    - `GET /stages` / `PUT /stages` (configure pipeline per tenant).
- Activities:
    - `GET /activities` (for contact/deal timeline).
    - `POST /activities`.

All routes use your existing tenant context middleware and RBAC (e.g. `crm.view`, `crm.edit`).[^4][^1]

***

## 4. Frontend module in the dashboard

Add a **CRM** section to the React dashboard:

- **Contacts view**:
    - Table with search and filters.
    - Quick actions: view details, create deal, log activity.
- **Pipeline view**:
    - Kanban board grouped by `crm_stages` (per tenant).
    - Drag-and-drop stage changes using your drag library (same as dashboard builder if you reuse it).
    - Columns show counts and sum of `amount`.
- **Deal detail**:
    - Right-side drawer or page showing:
        - Deal info.
        - Linked contact(s).
        - Activities (notes, calls, meetings).
        - Basic KPIs (days in stage, days open).

This is a common “lightweight CRM” pattern seen in many B2B SaaS tools.[^5][^3]

***

## 5. Integrations with HubSpot/Salesforce (Phase M tie-in)

Once the native CRM exists, add **sync connectors** using the OAuth tokens from Phase M:

- **Integration mapping tables**:
    - `crm_contact_integrations`:
        - `id`, `contact_id`, `integration_key` (`hubspot`, `salesforce`), `external_id`.
    - `crm_deal_integrations`:
        - `id`, `deal_id`, `integration_key`, `external_id`.
- **Sync strategies**:
    - Start with **one-way import**:
        - From HubSpot/Salesforce into AIISTECH CRM.
        - Use their APIs with stored OAuth tokens to pull contacts/deals, then upsert into your tables.
    - Later add:
        - One-way push (AIISTECH → external).
        - Or controlled bidirectional sync with conflict rules.

Pattern-wise, this is similar to multi-tenant integration systems where a central “integration hub” maps internal IDs to external system IDs and handles synchronization.[^6][^1][^2]

***

## 6. Scheduling syncs (shared-host constraints)

On cPanel:

- Use cron + internal jobs:
    - e.g. every 5–15 minutes, hit `/api/crm/sync/hubspot` for tenants with active HubSpot integration.
- Each sync job:
    - Uses tenant’s OAuth tokens from `tenant_integrations`.
    - Fetches changes since last sync (using updatedAt or provider’s paging).
    - Upserts contacts/deals and updates `crm_*_integrations`.

You can reuse the same scheduling pattern you’ll use for automated reporting: cron → Node endpoint → DB-backed queue/loop.[^7][^8]

***

## 7. AI touchpoints (later tie-in to P/R)

- In the CRM **pipeline view**:
    - “AI summarize pipeline” → uses your AI assistant to summarize deals/risks.
- In contact/deal detail:
    - “Draft follow-up email” → uses the Gemini copy generation service with deal context.

These reuse the AI service from Phase P/R; the CRM just becomes another data source.[^9][^10][^11]

***

## 8. Milestones

1. **S1 – Core CRM data model \& APIs**
    - Tables: contacts, deals, stages, activities.
    - Basic CRUD APIs, tenant-scoped.
2. **S2 – CRM UI in dashboard**
    - Contacts table, pipeline board, deal detail plus activity log.
3. **S3 – Integrations groundwork**
    - Mapping tables (`*_integrations`).
    - Basic one-way import from HubSpot for one test tenant.
4. **S4 – Sync scheduling \& polishing**
    - Cron-based sync jobs.
    - Error handling and conflict defaults (e.g. “external wins” for now).

On your shared-server AIISTECH platform, S1–S2 are entirely local (Node + SQL + React), giving you immediate business value; S3–S4 then turn it into a hub that can reflect external CRMs when tenants connect them.

<div align="center">⁂</div>

[^1]: https://github.com/microsoftdocs/architecture-center/blob/main/docs/guide/multitenant/approaches/integration.md

[^2]: https://dev.to/genesis_technologies/building-scalable-multi-tenant-integrations-lessons-from-real-world-saas-projects-43cl

[^3]: https://success.outsystems.com/documentation/11/app_architecture/designing_the_architecture_of_your_outsystems_applications/designing_scalable_multi_tenant_applications/

[^4]: https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-api-access-authorization/introduction.html

[^5]: https://thereportinghub.com/blog/how-to-structure-a-multi-tenant-analytics-delivery-system-without-rebuilding-everything

[^6]: https://blog.logto.io/build-multi-tenant-saas-application

[^7]: https://github.com/dimagi/email-reports

[^8]: https://www.oreateai.com/blog/design-and-implementation-of-a-multitenant-scheduled-task-scheduling-system-based-on-spring-quartz/436bfe74143f5ec350c9593a6e163af0

[^9]: https://github.com/munas-git/AI-powered-sales-dashboard

[^10]: https://firebase.google.com/docs/ai-logic/chat

[^11]: https://arsenaltech.com/blog/introduction-to-rag-retrievalaugmented-generation-for-saas-applications

