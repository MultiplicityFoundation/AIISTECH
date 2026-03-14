<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Lets expand on this into a dev plan and for starters we are going to use a shared server, with c-panel and node.js app install capabilities, also has database capabilities and domain and dns management:

Phase Y–Z: Launch \& Growth Layer
Y — White-Label \& Agency Mode: Allow agencies to resell AIISTECH under their own brand. Add logo/color theming per tenant, custom login screens, and the ability for agencies to manage sub-clients under their account

Phase Y should introduce a **tenant/agency metadata layer + theming engine + sub-tenant hierarchy**, while still running on your shared cPanel Node stack.

***

## 1. Tenant \& agency data model

Add an “agency vs client” hierarchy on top of your existing tenants:

- Extend `tenants`:
    - Fields: `type` (`'direct' | 'agency' | 'client'`), `parent_tenant_id` (nullable).
    - `branding_theme_id` (FK to a new themes table).
- New `themes` table:
    - `id`, `tenant_id` (owner of the theme; for white-label agencies, that’s the agency tenant).
    - `name`
    - `logo_url` (main app logo)
    - `favicon_url`
    - `primary_color`, `secondary_color`, `accent_color`
    - `sidebar_bg`, `sidebar_text`, etc.
    - `login_background_url` / color
    - `login_title`, `login_description`
    - `is_default`
    - timestamps

This follows per-tenant branding patterns used in white-label multi-tenant SaaS: theme config (colors, logos, assets) stored per tenant.[^1][^2][^3][^4]

Agencies:

- An **agency tenant** can:
    - Have its own theme.
    - Own multiple **client tenants** (sub-accounts) via `parent_tenant_id`.[^5][^6][^7][^8]

***

## 2. Theming engine in the frontend

Use your existing shadcn/Tailwind setup and inject tenant theme at runtime:

- On app bootstrap:
    - Backend includes current tenant’s theme in `/me` or `/tenant` API.
    - React `TenantProvider` sets CSS variables/classes:
        - `--color-primary`, `--color-accent`, etc.
        - `data-tenant-theme="<tenant-slug>"`.[^9][^3]
- For logos and icons:
    - Navbar uses `theme.logo_url` instead of a hardcoded logo.
    - Set `<link rel="icon" href={theme.favicon_url}>` dynamically (or via server-side injection).

This mirrors how white-label systems dynamically inject CSS and logos per tenant while keeping core code shared.[^2][^4][^9]

***

## 3. Custom login screens per tenant

Use your existing auth route but theme it per tenant/domain:

- Tenant resolution:
    - From host: `client.aiistech.com` or custom domain → lookup tenant, then load `theme`.[^10][^11][^2]
- Login page:
    - Background image/color from `theme.login_background_*`.
    - Logo from `theme.logo_url`.
    - Title/description from `theme.login_title`/`theme.login_description`.
- Default fallbacks:
    - If no tenant theme found, fall back to AIISTECH default.

This is similar to Entra and other IAM branding: per-tenant/company branding applied at sign-in.[^12][^13][^11][^10]

***

## 4. Agency mode: sub-clients management

For **agency tenants** (type `'agency'`):

- Capabilities:
    - Create and manage **sub-client tenants**:
        - `POST /api/agency/clients` → new tenant with `parent_tenant_id = agencyTenantId`.
    - See a list of client tenants in an “Agency” dashboard:
        - Name, domain, active users, plan, status.[^6][^14][^7][^8][^5]
    - Switch context into a client account (like GoHighLevel’s Agency vs Sub-Account model).[^7][^8]

Data:

- `tenants` row per client.
- Optional `agency_client_settings` table:
    - `client_tenant_id`, `agency_tenant_id`
    - `plan_tier`, `features_enabled`, `billing_mode` (agency-billed vs direct).

Permissions:

- New roles/permissions:
    - `agency.owner` at the agency tenant.
    - `clients.manage` to create/delete client accounts.
- When an agency user “switches into” a client account, your tenant context changes but identity remains associated with the agency for audit.

Patterns follow well-known agency/sub-account models (GoHighLevel, agency SaaS templates).[^8][^15][^5][^6][^7]

***

## 5. White-label experience scope

For agencies and their clients:

- Branding:
    - Custom domain (from earlier phases).
    - Tenant-specific theme (colors, logos, fonts).
    - Tenant-specific login page.
- Content:
    - Branded email templates (header logo + colors) using `theme` fields.
- Visibility:
    - AIISTECH brand can be hidden or minimized for white-label tenants (config flag).

This matches multi-tenant white-label guidance: branding (logo/theme/domain) configured per tenant, with agencies presenting the platform fully as their own.[^4][^16][^2]

***

## 6. Milestones

1. **Y1 – Theme model \& per-tenant branding**
    - `themes` table and association with `tenants`.
    - API to get/update theme (tenant admin only).
    - Frontend `TenantProvider` applying CSS vars/logo based on theme.[^3][^9][^2]
2. **Y2 – Branded login**
    - Tenant resolution by host.
    - Login page using tenant theme (logo, colors, copy).[^13][^11][^12][^10]
3. **Y3 – Agency \& sub-clients**
    - Tenant types + `parent_tenant_id`.
    - Agency dashboard to create/manage client tenants and switch into them.[^5][^6][^7][^8]
4. **Y4 – White-label polish**
    - Branded emails.
    - Option to hide AIISTECH branding for agency tenants (config).

On your current shared-server setup, all of this is DB + Node + React work; the multi-tenant/domain plumbing from earlier phases gives you the runtime separation needed.

Do you want to support agencies creating client accounts **manually only** at first, or also via a self-serve signup flow that auto-creates sub-accounts?
<span style="display:none">[^17][^18][^19][^20]</span>

<div align="center">⁂</div>

[^1]: https://github.com/enkodellc/blazorboilerplate/issues/347

[^2]: https://www.abbacustechnologies.com/how-custom-multi-tenant-saas-platforms-serve-multiple-clients-efficiently/

[^3]: https://www.dundas.com/support/learning/documentation/administration-configuration-customization/customize-branding-for-each-tenant

[^4]: https://sysgenpro.com/resources/white-label-saas-erp-multi-tenant-model

[^5]: http://github.com/aiurda/agencyflow

[^6]: https://github.com/denvudd/plura

[^7]: https://profunnelbuilder.com/gohighlevel-agency-account-vs-sub-account/

[^8]: https://www.sasolutionspk.com/go-high-level/gohighlevel-for-agencies-the-sub-account-model-explained/

[^9]: https://www.linkedin.com/pulse/how-i-built-production-ready-white-label-system-under-jason-vertrees-qh4yc

[^10]: https://learn.microsoft.com/en-us/entra/external-id/customers/how-to-customize-branding-themes-apps

[^11]: https://www.youtube.com/watch?v=A8juIv84jZI

[^12]: https://github.com/MicrosoftDocs/entra-docs/blob/main/docs/external-id/customers/how-to-customize-branding-customers.md

[^13]: https://github.com/MicrosoftDocs/entra-docs/blob/main/docs/fundamentals/how-to-customize-branding.md

[^14]: https://github.com/abdulrehman104/Agency-Management-System

[^15]: https://help.gohighlevel.com/support/solutions/articles/48001188055-convert-existing-sub-account-to-saas-mode-subscription-plan

[^16]: https://spreecommerce.org/launching-a-white-label-multi-tenant-ecommerce-platform-what-it-takes/

[^17]: https://github.com/Microsoft/WingtipTicketsSaaS-DbPerTenant

[^18]: https://github.com/lanemc/multi-tenant-saas-toolkit

[^19]: https://github.com/innov8go/color-admin/blob/master/login_v3.html

[^20]: https://github.com/topics/multitenancy?l=typescript\&o=desc\&s=updated

