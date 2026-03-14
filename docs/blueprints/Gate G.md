<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Lets expand on this into a dev plan and for starters we are going to use a shared server, with c-panel and node.js app install capabilities, also has database capabilities and domain and dns management:

Phase G–I: Dashboard \& Page Builder
This is the core differentiator — letting clients build their own dashboards and pages without code.
G — Drag-and-Drop Dashboard Builder: Build a widget-based dashboard composer using react-grid-layout or dnd-kit. Clients select KPI cards, charts, tables, and embed feeds. Persist layouts per user in the database

To get Phase G moving on a shared cPanel server, treat the **drag-and-drop dashboard builder** as a self-contained feature slice that sits on top of your existing dashboard API and upcoming tenant model. The goal: each user in each tenant can compose their own layout of KPI cards, charts, tables, and embeds, and have it persist reliably in your database.

***

## 1. Core concept and constraints

On shared hosting, you want the dashboard builder to be **front-end heavy** and **API-light**:

- Use a mature, grid-based layout library like **react-grid-layout**, which is designed specifically for draggable/resizable dashboard grids in React and supports responsive layouts and layout change callbacks.[^1][^2][^3]
- Keep backend storage simple: one `dashboard_layouts` table that stores JSON layout definitions per user + tenant + dashboard type.
- Avoid server-side rendering or heavy real-time sync in the first iteration; a simple “save layout” on change or on explicit save is enough.

react-grid-layout fits well with your existing React + TypeScript + shadcn/ui frontend: it lets you define a layout array (`[{ i, x, y, w, h, ... }]`) and renders children into a draggable/resizable grid, emitting `onLayoutChange` when the user rearranges items.[^2][^3][^1]

***

## 2. Data model for layouts

Extend your database (same DB used for tenants and users) with:

- `dashboard_layouts`
    - `id`
    - `tenant_id`
    - `user_id`
    - `dashboard_key` (e.g. `overview`, `automations`, `processes`, `billing`)
    - `layout_json` (JSON of react-grid-layout items)
    - `widgets_json` (optional JSON describing which widget types/props are in each cell)
    - `is_default` (for tenant-wide default layouts)
    - `created_at`, `updated_at`

One **layout record** might look like:

- `dashboard_key = 'overview'`
- `layout_json = [ { "i": "kpi-cost-savings", "x":0,"y":0,"w":4,"h":2 }, … ]`
- `widgets_json = { "kpi-cost-savings": { "type":"KPI_CARD", "metricKey":"cost_savings_ytd" }, … }`

This structure keeps layout coordinates separate from widget semantics, which aligns with dashboard builder best practices and makes it easier to add new widget types later.[^4][^3][^1]

***

## 3. Backend endpoints

Add a small “dashboard layouts” API surface to your Node backend (same cPanel Node app):

1. `GET /api/dashboard-layouts/:dashboardKey`
    - Authenticated, tenant-scoped.
    - Loads the user-specific layout for that dashboard, falling back to tenant default or system default if none exists.
2. `PUT /api/dashboard-layouts/:dashboardKey`
    - Authenticated.
    - Body: `{ layout: LayoutItem[], widgets: WidgetConfigMap }`.
    - Upserts the layout for `(tenant_id, user_id, dashboard_key)`.
3. (Later) `POST /api/dashboard-layouts/:dashboardKey/reset`
    - Resets to tenant default or system default layout.

Use your existing auth middleware and tenant context (from Phase D) so layouts are automatically scoped by tenant and user. You already pass `role` and `tenantId` in JWTs and use them in dashboard APIs, so adding user-tenant keys to layouts fits the current pattern.

***

## 4. Frontend UX flow

Add a **“Customize dashboard”** mode to each dashboard route (overview, automations, processes, billing):

- Normal mode:
    - Grid is static.
    - Layout and widgets are loaded from `/api/dashboard-layouts/:key`, but dragging/resizing is disabled.
- Edit mode:
    - Toggle via a button (`Customize layout`).
    - Use react-grid-layout with `draggableHandle` (e.g. a small handle element in each widget) and `onLayoutChange`.
    - Show a side panel or modal with available widgets (KPI card, chart, table, embed, etc.) that users can drag into the grid.

Implementation steps with react-grid-layout:

- Define a layout state:
    - `const [layout, setLayout] = useState<Layout[]>();`
    - On mount, call `GET /api/dashboard-layouts/overview` and set the layout + widget configs.
- Render:
    - `<ReactGridLayout layout={layout} cols={12} rowHeight={30} onLayoutChange={handleLayoutChange}>`

```
- Render each widget inside a `<div key={item.i} data-grid={item}>...</div>`.[^1][^4][^2]
```

- Persist:
    - On “Save layout” click, call `PUT /api/dashboard-layouts/overview` with the current layout + widget configs.

react-grid-layout’s `onLayoutChange` callback provides a new layout array whenever the user drags or resizes a widget, allowing you to capture the entire dashboard state in the database.[^3][^2][^1]

***

## 5. Widget library

Define a small widget registry to start:

- `KPI_CARD` — pulls from your existing `/api/dashboard/:tenantId/summary` endpoint.
- `TREND_CHART` — pulls from `/api/dashboard/:tenantId/trends`.
- `PROCESS_TABLE` — pulls from `/api/dashboard/:tenantId/processes`.
- `BOTS_TABLE` — pulls from `/api/dashboard/:tenantId/bots`.
- `ALERTS_LIST` — pulls from `/api/dashboard/:tenantId/alerts`.
- `COMPLIANCE_SUMMARY` — pulls from `/api/dashboard/:tenantId/compliance`.
- `EMBED` — arbitrary iframe/URL with whitelisting.

Each widget instance in `widgets_json` would include at minimum:

- `type`
- `dataSource` or `metricKey` (for KPIs)
- `config` (visual options, e.g. chart type or date range)

This is similar to how other multi-tenant dashboard tools separate data semantics from layout, making it easier to keep security and data access rules consistent across tenants.[^5][^6]

***

## 6. Multi-tenant and RBAC considerations

Because AIISTECH is multi-tenant, and Phase F introduces per-tenant RBAC:

- Enforce per-route permissions on layout editing:
    - Example: `requirePermission('dashboards.customize')` on `PUT /api/dashboard-layouts/:key`.
    - Only admins or editors should be allowed to change layouts; viewers can only see them.
- Make layouts tenant-scoped:
    - Keys in `dashboard_layouts` must include `tenant_id` and `user_id`.
    - If you later add tenant-level default layouts, they become entries with `user_id` = NULL and `is_default = true`.

This matches guidance on multi-tenant dashboard builders: separate configuration from data access, and make sure tenant context and permissions are consistently enforced in every query and widget.[^6][^7][^5]

***

## 7. Phased delivery

For Phase G specifically:

1. **G1 – Minimal per-user layout**
    - Implement `dashboard_layouts` table.
    - Implement `GET/PUT /api/dashboard-layouts/:key`.
    - Wrap existing overview dashboard contents in react-grid-layout, with drag-and-drop and save.
2. **G2 – Widget picker and types**
    - Add a widget palette with a handful of widgets wired to existing dashboard APIs (`summary`, `trends`, `processes`, etc.).
    - Allow adding/removing widgets from the grid.
3. **G3 – Tenant defaults and RBAC**
    - Allow tenant admins to define default layouts applied to new users.
    - Enforce permissions on editing vs viewing.
4. **G4 – Performance and polish**
    - Optimize data loading (e.g. fetch data once per widget type and share across instances).
    - Add responsive breakpoints and mobile-friendly layouts via react-grid-layout’s responsive features.[^3][^1]

This keeps Phase G focused, achievable on shared hosting, and immediately valuable to clients while the deeper Page Builder work (Phase H) and automations are still in progress.

Would you like the next iteration to define the exact `dashboard_layouts` schema and the first React component skeleton for the customizable overview dashboard?
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://github.com/react-grid-layout/react-grid-layout

[^2]: https://codesandbox.io/examples/package/react-grid-layout

[^3]: https://www.ilert.com/blog/building-interactive-dashboards-why-react-grid-layout-was-our-best-choice

[^4]: https://stackoverflow.com/questions/66438916/how-to-create-dynamic-drag-and-drop-layout-with-react-grid-layout

[^5]: https://seedium.io/blog/how-to-build-multi-tenant-saas-architecture/

[^6]: https://embeddable.com/blog/multi-tenant-dashboards-in-saas-how-embeddable-handles-security-and-scale

[^7]: https://blog.logto.io/build-multi-tenant-saas-application

[^8]: https://github.com/olliethedev/dnd-dashboard

[^9]: https://github.com/apache/superset/discussions/29899

[^10]: https://github.com/react-grid-layout/react-draggable

[^11]: https://github.com/clauderic/dnd-kit/discussions/809

[^12]: https://github.com/javaid-dev/multi-tenant-saas-platform

[^13]: https://github.com/Make-md/react-grid-layout

[^14]: https://github.com/clauderic/dnd-kit

[^15]: https://github.com/lanemc/multi-tenant-saas-toolkit

[^16]: https://github.com/avalner/react-grid-layout

[^17]: https://www.chetanverma.com/blog/how-to-create-an-awesome-kanban-board-using-dnd-kit

[^18]: https://codesandbox.io/s/dashboard-layout-dnd-kit-vedn1

[^19]: https://www.ensolvers.com/post/drag-and-drop-dashboards-with-react-dnd

