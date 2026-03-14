F — RBAC v2: Extend the existing 4-role system to fully configurable per-tenant roles and permissions (admin, editor, viewer, custom). The repo has Phase 3 RBAC hardening already started

Phase F is where you turn the current hardcoded 4-role setup (EXECUTIVE, FINANCE, OPERATIONS, IT) into a **tenant-scoped, configurable** RBAC system with default roles plus per-tenant custom roles. The backend already includes `role` and `tenantId` in the JWT payload and uses them in dashboard endpoints, so we’re extending an existing shape rather than starting over.[^1]

Below is a concise dev plan tailored to your shared-server, cPanel + Node.js + SQL setup.

***

## 1. Target model and constraints

On a shared server you want RBAC to be **application-level**, driven by the database and enforced in middleware/services, without relying on external policy engines. Multi-tenant RBAC best practice is: roles, permissions, role_permission map, user_role map, all scoped by tenant.[^2][^3][^1]

For AIISTECH, the targets are:

- Global base roles: EXECUTIVE, FINANCE, OPERATIONS, IT (for dashboards), plus system-wide ADMIN.
- Tenant-scoped roles: `admin`, `editor`, `viewer`, and arbitrary custom roles per tenant.
- Permission strings like `projects:create`, `billing:view`, `billing:manage`, `users:invite`, `dashboards:edit`.

This aligns with guidance that defines roles as bundles of permissions, and permissions as fine-grained actions, with tenant scope as the boundary.[^3][^4][^1]

***

## 2. Database design (shared SQL DB)

Introduce these tables (or equivalent Prisma models), all keyed with `tenant_id` so roles and permissions are per-organization:[^5][^1][^2]

- `permissions`
    - `id`, `key` (e.g. `projects.create`), `description`.
    - Global set (no `tenant_id`) so you don’t explode the permission set per tenant.
- `roles`
    - `id`, `tenant_id`, `key` (e.g. `admin`, `editor`), `name`, `is_system` (true for your fixed roles).
    - Seed default roles for every tenant: `admin`, `editor`, `viewer`, and one or more domain roles like `executive`.
- `role_permissions`
    - `role_id`, `permission_id` (composite PK).
    - Defines what each role can actually do.
- `user_roles`
    - `user_id`, `tenant_id`, `role_id` (composite PK).
    - Allows users to have different roles in different tenants, which is a common multi-tenant pattern.[^4][^2][^5]

You already carry `role` and `tenantId` inside JWTs and in your in-memory demo user objects.  Over time, you’ll shift from a single `role` field to a “current role” or “effective permissions” derived from `user_roles` per request.

***

## 3. Migration from current 4-role model

Short-term, preserve compatibility with the existing role names used by dashboards (EXECUTIVE, FINANCE, OPERATIONS, IT).

- Seed `permissions` that correspond to existing capabilities:
    - `dashboards.view_overview`, `dashboards.view_automations`, `dashboards.view_processes`, `billing.view`, `billing.manage`, `projects.manage`, etc.
- Seed `roles` for the tenant(s) you already have:
    - For example, for `tenant-1`, create roles: `EXECUTIVE`, `FINANCE`, `OPERATIONS`, `IT`, `admin`, `editor`, `viewer`.
- Seed `role_permissions`:
    - `EXECUTIVE` gets high-level analytics and billing view permissions.
    - `FINANCE` gets `billing:view`, maybe `billing:manage`.
    - `OPERATIONS` gets process and automation permissions.
    - `IT` gets deployment and technical settings.
- Populate `user_roles` for your existing demo users based on their current `role` field and `tenantId`.

During this migration, keep `req.user.role` in the JWT but treat it as a **derived, display-oriented role**; the source of truth becomes `user_roles` and `role_permissions`.

***

## 4. Permission check layer

Add a small authorization module rather than scattering checks across routes. Patterns from multi-tenant RBAC examples are: compute effective permissions for a user+tenant, cache them briefly, and evaluate checks like `can(user, tenant, 'projects:create')`.[^1][^2][^4]

Implementation steps:

1. On each request:
    - Use existing auth middleware to load `req.user` with `id` and `tenantId`.
    - Use tenant resolution (host → tenant) from your tenant/org work in Phase D.
2. Add a `loadPermissions(userId, tenantId)` function:
    - Join `user_roles` → `role_permissions` → `permissions` and return a list of permission keys.
3. Cache the computed list for `(userId, tenantId, policyVersion)` in memory with a short TTL (e.g. 5 minutes) to avoid hitting the DB on every check, as recommended in typical RBAC performance patterns.[^2][^1]
4. Implement a helper:
    - `function requirePermission(permissionKey) { return (req, res, next) => { ... } }`
    - Use in routes like: `app.post('/api/projects', authenticateToken, requirePermission('projects.create'), handler)`.

This is an app-layer RBAC that composes cleanly with any database-level RLS you add later.

***

## 5. Mapping roles to UI and routes

You’ll need a clear mapping from permissions to UI capabilities and endpoints. Some examples for AIISTECH:

- `projects.create`, `projects.update`, `projects.delete`, `projects.deploy`
    - Gate the `/api/projects` CRUD and deploy/teardown routes, currently guarded by owner/tenant checks.
- `billing.view`, `billing.manage`
    - Gate the billing dashboard route and any endpoints that create Stripe sessions or manage subscriptions (Phase E).
- `users.invite`, `users.manage_roles`
    - Gate tenant admin pages where admins assign roles to other users.
- `dashboards.view_overview`, `dashboards.view_automations`, `dashboards.view_processes`, `dashboards.view_billing`, `dashboards.view_compliance`
    - Gate which dashboard sections each role can see — the API already has per-tenant dashboard summary, processes, bots, alerts, and compliance endpoints.

Align the React side by:

- Fetching `effectivePermissions` or `effectiveRoles` once on login or via `/api/auth/me`.
- Using those flags to hide/disable nav items, buttons, and actions that the user cannot perform.

***

## 6. Per-tenant configurability (RBAC v2)

Once the base tables and checks are in place, enable per-tenant customization:

- Tenant admins (with `rbac.manage` or `roles.manage`) get a **Roles** UI:
    - List roles for their tenant.
    - Create new custom roles (e.g. `Sales Manager`).
    - Assign permissions to roles via a simple UI (checklist of permissions).
- A **Members** UI:
    - Shows each user in the tenant and their roles.
    - Allows assigning/removing roles per user (per tenant).

Best practice for multi-tenant RBAC is to keep the **permission vocabulary global**, but allow tenants to group them into roles differently.  That’s exactly what this model does: you never create tenant-specific permission keys, just tenant-specific roles and role-permission associations.[^4][^1][^2]

***

## 7. Shared-server specific considerations

On cPanel/shared hosting:

- Keep RBAC logic inside the Node app; you don’t want external policy services that require extra infrastructure.
- Use the same SQL database you configured for tenants and billing.
- Because you don’t have Redis or a dedicated cache, use in-process caching for computed permissions with short TTLs; if the app restarts, permissions will recompute naturally.[^2]

Make sure your seed and migration scripts can run via CLI or cPanel terminal (e.g., `node prisma/seed-rbac.js` or similar) so that you can bootstrap roles/permissions on staging/production without manual SQL.

***

## 8. Phased delivery

A minimal but effective rollout for Phase F:

1. **F1 — Schema \& seeding**
    - Add `permissions`, `roles`, `role_permissions`, `user_roles` tables.
    - Seed default permissions and roles (system-level and per-tenant).
2. **F2 — Enforcement in backend**
    - Implement `requirePermission` middleware.
    - Apply to high-value routes: projects, billing, user management, tenant admin.
3. **F3 — Frontend awareness**
    - Expose effective permissions/roles via `/api/auth/me`.
    - Hide buttons/nav where the user lacks permission.
4. **F4 — Tenant admin UI**
    - Build Roles and Members screens under a “Settings / Access control” or similar path.
    - Allow tenant admins to create roles and assign permissions and users.
5. **F5 — Hardening \& audits**
    - Add logging for denied permission checks to your existing auth audit logging pipeline.
    - Add tests that verify users of different roles cannot access or perform disallowed actions.

If you like, I can next sketch the exact permission list and one concrete “RBAC core” module (functions and middleware signatures) that fits your current `server.js` structure.
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.techosquare.com/blog/rbac-for-multi-tenant-apps

[^2]: https://workos.com/blog/how-to-design-multi-tenant-rbac-saas

[^3]: https://www.tencentcloud.com/techpedia/108537

[^4]: https://clerk.com/blog/how-to-design-multitenant-saas-architecture

[^5]: https://www.reddit.com/r/Supabase/comments/1iyv3c6/how_to_structure_a_multitenant_backend_in/

[^6]: https://github.com/donchi4all/multi-tenant-rbac

[^7]: https://github.com/spatie/laravel-permission/issues/280

[^8]: https://github.com/gjhernandezp/algorithms/blob/master/Python/Colab_Yahoo_Finance_Data.ipynb

[^9]: https://github.com/point-source/supabase-tenant-rbac/

[^10]: https://github.com/spatie/laravel-permission/issues/1744

[^11]: https://github.com/simolus3/drift/issues/265

[^12]: https://github.com/JonPSmith/AuthPermissions.AspNetCore/discussions/77

[^13]: https://github.com/spatie/laravel-permission/issues/657

[^14]: https://github.com/quarkusio/quarkus/issues/15836

[^15]: https://github.com/point-source/supabase-tenant-rbac

[^16]: https://www.aserto.com/blog/authorization-101-multi-tenant-rbac

[^17]: https://managed-keycloak.inteca.com/identity-access-management/role-based-access-control/

[^18]: https://www.ibm.com/think/topics/rbac

[^19]: https://www.ninjaone.com/blog/how-to-design-and-operate-multi-tenancy-with-rbac/

[^20]: https://air-governance-framework.finos.org/mitigations/mi-12_role-based-access-control-for-ai-data.html

