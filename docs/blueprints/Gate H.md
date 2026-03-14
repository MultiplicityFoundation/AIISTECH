<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Lets expand on this into a dev plan and for starters we are going to use a shared server, with c-panel and node.js app install capabilities, also has database capabilities and domain and dns management:

H — Website \& Landing Page Builder: Integrate a visual page builder (GrapesJS or a custom block-based editor). Store page schemas as JSON in the DB. Allow clients to preview, publish, and version-control their pages

Phase H on shared hosting should be a **GrapesJS-based page builder** embedded into your existing React app, with page schemas stored as JSON in your database and a simple publish pipeline to your cPanel-hosted domains. GrapesJS is purpose-built for visual page editing and already supports JSON project data via its Storage Manager, which fits your “schema-first in DB” requirement.[^1][^2][^3]

***

## 1. Scope and constraints

On a shared cPanel server with Node.js and SQL:

- Run the **builder UI** inside your React/Vite app using GrapesJS (or GrapesJS React wrapper).[^4][^5][^6]
- Persist **page schemas as JSON** in a `pages` table; treat HTML/CSS as build artifacts, not the source of truth, as GrapesJS docs recommend.[^2][^3]
- Serve published pages as static HTML from cPanel (or via your Node app) under tenant-specific subdomains (from your Phase D tenant/domain model).
- Version-control pages at the DB layer: a `page_versions` table that stores snapshots of the JSON schema.

This fits GrapesJS’ guidance: always rely on the project JSON (components, styles, assets, pages) for storage, not the exported HTML/CSS.[^3][^2]

***

## 2. Data model

Add at least two tables:

- `pages`
    - `id`
    - `tenant_id`
    - `slug` (e.g. `home`, `pricing`, `landing-x`)
    - `name`
    - `status` (`draft`, `published`, `archived`)
    - `current_version_id`
    - `created_at`, `updated_at`
- `page_versions`
    - `id`
    - `page_id`
    - `version_number`
    - `schema_json` (GrapesJS project JSON: components, styles, assets, pages)[^2][^3]
    - `html` (optional, generated at publish)
    - `css` (optional, generated at publish)
    - `created_by_user_id`
    - `created_at`

This lets you:

- Use `schema_json` as the canonical editable representation.
- Generate HTML/CSS for fast serving when a version is published.
- Allow rollback by switching `current_version_id`.

***

## 3. GrapesJS integration in your React app

Use a **builder route** in your app, e.g. `/builder/:pageId`:

- In React, mount GrapesJS on a `div` when the component loads.[^5][^6][^1]
- Load existing JSON schema via `GET /api/pages/:id` and initialize the editor with it.
- Configure GrapesJS Storage Manager with `type: 'remote'` and your Node API endpoints, so `editor.store()` and `editor.load()` go directly to your backend.[^7][^8][^2]

Example GrapesJS config (conceptual):

```js
const editor = grapesjs.init({
  container: '#gjs',
  height: '100%',
  plugins: ['grapesjs-preset-webpage'], // plus blocks/forms as needed [web:143][web:155]
  storageManager: {
    type: 'remote',
    stepsBeforeSave: 1,
    options: {
      remote: {
        urlLoad: `/api/pages/${pageId}`,
        urlStore: `/api/pages/${pageId}`,
        contentTypeJson: true,
        onStore: data => ({ data }),
        onLoad: res => res.data,
      },
    },
  },
});
```

This pattern mirrors GrapesJS examples where project data is stored remotely as JSON, with `onStore`/`onLoad` adapting your API shape.[^8][^9][^2]

***

## 4. Backend API (Node on cPanel)

Add endpoints:

- `POST /api/pages`
    - Create a new page for the current tenant; optionally seed with a template.
- `GET /api/pages/:id`
    - Return `{ data: schema_json }` for GrapesJS storage manager.
- `PUT /api/pages/:id`
    - Accept `{ data: schema }`, create a new `page_versions` record, and optionally keep a “draft” version.
- `POST /api/pages/:id/publish`
    - Load the latest schema, generate HTML/CSS with GrapesJS server-side or from the editor’s export payload, store them in `page_versions`, mark this version as `current_version_id`, and set page `status = 'published'`.

GrapesJS examples and docs show that project data is a JSON object containing all necessary information (styles, pages, etc.), and you can adapt Storage Manager `onStore`/`onLoad` handlers to align with your API.[^7][^8][^3][^2]

***

## 5. Preview and publish flow

On shared hosting:

- **Preview**:
    - Add a preview URL such as `/preview/:pageId?version=:version`. Your Node app reads `schema_json`, runs it through a minimal server-side renderer or uses stored HTML/CSS, and returns a full HTML page.
    - Alternatively, have GrapesJS generate HTML/CSS in the browser on “Preview” and open a new window with that content (fast but less canonical).
- **Publish**:
    - When a tenant user clicks “Publish” in the builder UI:

1. Send the current schema to `POST /api/pages/:id/publish`.
2. Generate HTML/CSS for that version and store it.
3. Write or update a static file for that path (e.g. via a small deploy step), or serve the published HTML from your Node app at tenant-specific URLs like `https://client.aiistech.com/slug`.

You can keep the initial implementation simple by **serving published pages dynamically** from Node (reading `html`/`css` from DB) and only later optimizing to static files if needed.

***

## 6. Multi-tenant and routing

Tie pages into your tenant/domain model (Phase D):

- Each `page` belongs to a `tenant_id`.
- At runtime, derive tenant from hostname (e.g. `client.aiistech.com`) and route to the correct page:
    - `https://client.aiistech.com/` → tenant’s `home` page.
    - `https://client.aiistech.com/offer-x` → page with `slug='offer-x'` for that tenant.

This is consistent with cPanel wildcard subdomains, where `*.aiistech.com` can point to the same app and your Node middleware determines which tenant and page to serve based on `req.hostname` and URL path.[^10][^11][^12]

***

## 7. Version control \& RBAC

Versioning:

- Every save in the builder creates a new `page_versions` row with `status='draft'`.
- Publish marks a version as current; the builder UI should list versions with timestamps and authors.
- Provide “Rollback” by switching `current_version_id` to a previous version.

RBAC:

- Guard builder access and publish actions with permissions from Phase F:
    - `pages.edit` for editing in GrapesJS.
    - `pages.publish` for publishing/rolling back.
- Only users with those permissions (e.g. tenant admins/editors) see the builder UI and publish controls.

***

## 8. Phased delivery on shared hosting

A lean rollout:

1. **H1 – Minimal builder**
    - Integrate GrapesJS into a protected route in your React app.
    - Hard-code basic blocks using `grapesjs-preset-webpage` and `grapesjs-blocks-basic`.[^13][^6][^1]
2. **H2 – DB-backed storage \& versions**
    - Add `pages` and `page_versions` tables.
    - Implement remote Storage Manager endpoints using JSON schema.[^8][^7][^2]
3. **H3 – Preview \& publish**
    - Add preview endpoint and page.
    - Implement publish endpoint and tenant-aware routing for live pages.
4. **H4 – Templates and blocks**
    - Create a small library of branded blocks (hero, pricing, features, CTA) via GrapesJS block manager.[^14][^6][^15]
    - Add page templates tenants can clone.

This keeps Phase H grounded: one editor, one JSON schema model, one DB, and cPanel-serving for live pages, all sitting cleanly on your shared-server stack.

What type of pages do you want to support first (e.g., home pages, single-offer landers, or multi-section marketing sites)?
<span style="display:none">[^16][^17][^18][^19][^20][^21][^22][^23]</span>

<div align="center">⁂</div>

[^1]: https://github.com/GrapesJS/grapesjs

[^2]: https://grapesjs.com/docs/modules/Storage.html

[^3]: https://app.grapesjs.com/docs-sdk/configuration/projects

[^4]: https://github.com/GrapesJS/react

[^5]: https://esketchers.com/landing-pages-with-react-and-grapesjs/

[^6]: https://dev.to/rafaelmagalhaes/building-a-website-builder-with-react-12f9

[^7]: https://gist.github.com/anish2690/408b808d1574bc1096e82038b12d3d20

[^8]: https://github.com/GrapesJS/grapesjs/issues/597

[^9]: https://github.com/artf/grapesjs/issues/2484

[^10]: https://support.cpanel.net/hc/en-us/articles/4416167771543-How-to-create-wildcard-subdomains

[^11]: https://github.com/WordPress/Advanced-administration-handbook/blob/main/server/subdomains-wildcard.md

[^12]: https://www.meinfoway.com/support/article/190/How-to-create-wildcard-subdomain-in-cPanel.html

[^13]: https://github.com/GrapesJS/preset-webpage

[^14]: https://github.com/GrapesJS/grapesjs/discussions/5255

[^15]: https://grapesjs.com/docs/modules/Blocks.html

[^16]: https://github.com/thanhtunguet/grapesjs-react/issues/8

[^17]: https://github.com/GrapesJS/grapesjs/issues/3206

[^18]: https://github.com/GrapesJS/grapesjs/issues/1274

[^19]: https://github.com/beepsoft/grapesjs-react-component-example

[^20]: https://www.youtube.com/watch?v=OrmTPoaWvgI

[^21]: https://gjs.market/blogs/integrating-grapesjs-into-a-vue-3-app-complete-guide-for-202

[^22]: https://www.youtube.com/watch?v=xaZBqQ19OlM

[^23]: https://grapesjs.com

