<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Lets expand on this into a dev plan and for starters we are going to use a shared server, with c-panel and node.js app install capabilities, also has database capabilities and domain and dns management:

Q — Automated Reporting: Build a scheduled report engine — clients configure report templates (metrics + time range + recipients) and the system auto-generates and emails PDF/HTML reports

For Phase Q on your shared cPanel stack, build a **simple, multi-tenant scheduled-report engine** inside the existing Node backend that can render HTML from your dashboards, optionally generate PDFs, and email them on a schedule.

***

## 1. What the reporting engine should do

Per tenant:

- Let admins define **report templates**:
    - Which dashboard/sections (overview, automations, processes, billing).
    - Time range (last 7 days, last 30 days, month-to-date).
    - Output format (HTML email body, optional PDF attachment).
    - Recipients (email list) and schedule (daily/weekly/monthly / specific time).
- On schedule:
    - Fetch metrics via your existing dashboard APIs.
    - Generate an HTML report (using a template).
    - Optionally render to PDF (Puppeteer-style HTML→PDF).[^1][^2][^3][^4]
    - Send email with HTML body + PDF attached.

This matches what tools like Matomo and Looker do: scheduled dashboard exports as email PDF/HTML reports for stakeholders.[^5][^6][^7]

***

## 2. Data model (DB on shared host)

Add:

- `report_templates`
    - `id`
    - `tenant_id`
    - `name`
    - `dashboard_key` (e.g. `overview`, `automations`)
    - `time_range` (`7d`, `30d`, `mtd`, custom)
    - `format` (`html`, `pdf`, `html+pdf`)
    - `schedule_cron` or structured schedule (`daily 08:00`, `weekly Mon 09:00`)
    - `is_enabled`
    - `created_by_user_id`
    - timestamps
- `report_recipients`
    - `id`
    - `report_template_id`
    - `email`
- `report_runs`
    - `id`
    - `report_template_id`
    - `tenant_id`
    - `status` (`pending`, `running`, `succeeded`, `failed`)
    - `started_at`, `finished_at`
    - `error_message`

This is similar to other scheduled report systems: template + recipients + run log.[^8][^6][^5]

***

## 3. Scheduling on a shared server

On cPanel:

- Use **cPanel cron** to hit a scheduler endpoint every minute:
    - e.g. `* * * * * curl -s https://api.aiistech.com/api/reports/run-due`
- Endpoint logic:
    - Find enabled `report_templates` whose schedule matches “now”.
    - For each, create a `report_runs` row and enqueue or run immediately.

This mimics how other reporting tools schedule email reports, without needing Quartz or external schedulers.[^9][^6][^8][^5]

***

## 4. Report generation pipeline

For each `report_run`:

1. **Load context**:
    - Tenant info.
    - Report template config (dashboard, time range).
2. **Fetch metrics**:
    - Call your existing dashboard APIs (summary, trends, processes, alerts, billing) with the chosen time range.
3. **Build HTML**:
    - Use a server-side template (e.g. Handlebars/EJS) that mirrors your dashboard styling:
        - Header: logo, tenant name, report title, date.
        - Sections: KPIs, charts (as images or tables), alerts.
    - Examples with Puppeteer + Handlebars show exactly this pattern: compile template with data → HTML → PDF.[^2][^3][^10][^1]
4. **Optional: generate PDF**:
    - Use Puppeteer (if allowed on your shared host) to render the HTML report to PDF.[^11][^10][^4][^1][^2]
    - If Puppeteer is not viable, start with HTML-only emails and add PDF later.
5. **Send email**:
    - Use an SMTP service or transactional email API.
    - HTML report in body; PDF attached if requested.

Node + Puppeteer HTML→PDF examples demonstrate this exact pipeline; you adopt a minimal version tailored to your dashboards.[^3][^10][^4][^1][^2][^11]

***

## 5. Using AI for report narratives (ties to Phase P)

Reuse your Gemini integration:

- After fetching metrics, call your AI service to generate a **narrative summary**:
    - “Generate a 3–5 bullet executive summary of these metrics.”
- Insert that summary as the first section of the report (“AI Insights”).

This is essentially Phase P’s dashboard summarization, but invoked in a scheduled context rather than on demand.[^12][^13][^14]

***

## 6. Tenant UI

Under a new **“Scheduled Reports”** section:

- List templates:
    - Name, dashboard, format, schedule, last run status.
- Editor:
    - Choose dashboard, time range, format.
    - Add recipients (emails).
    - Choose schedule (daily/weekly/monthly; later a cron-like advanced option).
- Test:
    - “Send test now” button that runs the report once and emails only the clicking user.

This matches UX patterns from tools like Matomo/Looker scheduled reports.[^6][^7][^5]

***

## 7. Multi-tenant \& RBAC

- All queries for templates/runs scoped by `tenant_id`.
- Only roles with `reports.manage` can create/edit templates.
- Other roles might see read-only lists or manually trigger reports.

***

## 8. Milestones

1. **Q1 – Template \& manual run**
    - DB schema + API for creating templates and recipients.
    - “Run now” endpoint that generates HTML and emails it immediately.
2. **Q2 – Scheduler**
    - cPanel cron hitting `/api/reports/run-due`.
    - Run logs (success/failure, timestamps).
3. **Q3 – PDF support (if feasible)**
    - Add Puppeteer-based HTML→PDF.
    - Option to include PDF attachment.
4. **Q4 – AI narratives**
    - Integrate existing Gemini summarization to add “AI Insights” to each report.

On your shared-server AIISTECH stack, Q1–Q2 give you real value quickly without heavy infra; PDFs and AI narrative are incremental enhancements, not prerequisites.
<span style="display:none">[^15][^16][^17][^18][^19][^20][^21][^22][^23]</span>

<div align="center">⁂</div>

[^1]: https://github.com/dharmeshkanzariya23/puppeteer-pdf-generator

[^2]: https://gist.github.com/maykbrito/444645526ac25a413021b0cd4d70fe24

[^3]: https://dzone.com/articles/how-to-generate-server-side-pdf-reports-with-puppe

[^4]: https://blog.risingstack.com/pdf-from-html-node-js-puppeteer/

[^5]: https://www.knowi.com/docs/email-reports.html

[^6]: https://oneuptime.com/blog/post/2026-02-17-schedule-email-looker-reports-stakeholders/view

[^7]: https://matomo.org/guide/manage-matomo/email-reports/

[^8]: https://github.com/dimagi/email-reports

[^9]: https://www.oreateai.com/blog/design-and-implementation-of-a-multitenant-scheduled-task-scheduling-system-based-on-spring-quartz/436bfe74143f5ec350c9593a6e163af0

[^10]: https://javascript.plainenglish.io/how-to-generate-server-side-pdf-reports-with-puppeteer-d3-and-handlebars-97bc8ed38a53

[^11]: https://github.com/PejmanNik/puppeteer-report

[^12]: https://ai.google.dev/api/generate-content

[^13]: https://ai.google.dev/gemini-api/docs/text-generation

[^14]: https://firebase.google.com/docs/ai-logic/generate-text

[^15]: https://github.com/MicrosoftDocs/azure-docs/blob/113c9b39114ea48474a5cc6f277f3929a01bbbbb/articles/azure-sql/database/saas-tenancy-cross-tenant-reporting.md

[^16]: https://github.com/CNuge/email-report

[^17]: https://github.com/apache/superset/discussions/29899

[^18]: https://github.com/malike/elasticsearch-report-engine

[^19]: https://github.com/microsoftdocs/architecture-center/blob/main/docs/guide/multitenant/approaches/integration.md

[^20]: https://github.com/jsreport/jsreport

[^21]: https://success.outsystems.com/documentation/11/app_architecture/designing_the_architecture_of_your_outsystems_applications/designing_scalable_multi_tenant_applications/

[^22]: https://www.reddit.com/r/googlesheets/comments/1ltsi2y/can_google_sheets_really_send_scheduled_emails/

[^23]: https://thereportinghub.com/blog/how-to-structure-a-multi-tenant-analytics-delivery-system-without-rebuilding-everything

