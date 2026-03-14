D — Tenant \& Org Model: Add a tenants table with organization-level isolation. Each client gets their own workspace with subdomain routing (clientname.aiistech.com). Implement row-level security in PostgreSQL

Yes — Phase D should start now, but on a shared cPanel server I would split it into two layers: implement **application-enforced** tenant isolation immediately, and add database-enforced row-level security only if you use PostgreSQL, because PostgreSQL RLS works through table policies and is not just a generic cPanel feature.  AIISTECH already has useful groundwork for this, because the current backend payloads and project records already carry `tenantId`, and the CORS setup already anticipates `*.aiistech.com` subdomains.[^1][^2]

## Platform fit

Your current backend is already tenant-aware at the API shape level, since demo users include `tenantId`, project creation writes `tenantId`, and project listing filters by the authenticated tenant.  That means the first dev goal is not inventing tenancy from scratch, but replacing the in-memory tenant assumptions with a real organization model and making subdomain routing resolve each request into the correct tenant context.

If your shared host only gives you MySQL or MariaDB, then the “PostgreSQL RLS” part should be treated as phase two or moved to a managed Postgres service, because row-level security policies are a PostgreSQL capability implemented with `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY`.  If you do have PostgreSQL available through hosting or an external provider, then RLS becomes the defense-in-depth layer under the same tenant model.[^2][^1]

## Data model

Add four core tables first: `tenants`, `tenant_domains`, `users`, and `projects`, with every business row carrying a `tenant_id` foreign key.  The current backend already assumes a one-tenant-per-user relationship and tenant-scoped project access, so those same rules can move directly into the schema and service layer without changing the app’s conceptual model.

I would define the org model like this: one `tenant` is the organization, one `workspace` is the tenant’s app space, one or more `tenant_domains` map subdomains or custom domains to that tenant, and users belong to tenants through membership records rather than hardcoded demo objects.  This also prepares you for later RBAC expansion, since the repo already has role-based access behavior and Phase 3 RBAC hardening in progress.

## Subdomain routing

For cPanel, the practical routing model is a wildcard subdomain such as `*.aiistech.com` pointed at the same app location, because cPanel supports creating wildcard subdomains and requires the wildcard DNS record to point to the server.  That gives you the runtime pattern `clientname.aiistech.com -> resolve host -> look up tenant_domains -> load tenant -> continue request`.[^3][^4][^5]

The backend is already close to this model because its CORS regex allows `https://([a-z0-9-]+\.)?aiistech\.com`, which is exactly the sort of domain pattern you need for tenant subdomains.  The next step is adding middleware that reads `req.hostname`, matches it to a `tenant_domains` record, and stores the resolved tenant on the request before auth and data queries run.

## Isolation rules

On shared hosting, start with strict app-layer isolation in every query: every read and write must include `tenant_id`, and every authenticated request must derive its tenant from the signed identity plus the resolved hostname.  That is the fastest safe move because the current code already uses tenant checks in project routes, for example filtering project lists by `req.user.tenantId` and rejecting cross-tenant access.

If you run PostgreSQL, then mirror those same rules in RLS policies so the database itself filters visible rows and blocks writes that violate tenant boundaries.  PostgreSQL’s RLS model is specifically designed for multi-tenant isolation, using `USING` and `WITH CHECK` policy clauses to control which rows can be read or written.[^6][^1][^2]

## Delivery plan

I would break Phase D into this order so it fits shared hosting and the repo’s current maturity, which is still “production pending” with the backend marked mock-only.  First, create the tenant schema and move demo tenant data into the database; second, add hostname-to-tenant resolution middleware; third, convert all tenant-sensitive routes from in-memory objects to database queries; fourth, add wildcard subdomain support in cPanel and DNS; fifth, add custom-domain mapping after tenant subdomains are stable.[^5][^3]


| Step | Deliverable | Why first |
| :-- | :-- | :-- |
| 1 | `tenants` and `tenant_domains` tables | The backend already depends on `tenantId`, so persistence is the first missing piece. |
| 2 | Request tenant-resolution middleware | Subdomain routing depends on resolving the host before business logic runs. [^5] |
| 3 | Tenant-scoped query layer | Current project endpoints already enforce tenant filtering conceptually. |
| 4 | Wildcard subdomain in cPanel + DNS | cPanel wildcard domains and DNS records are the routing foundation for `clientname.aiistech.com`. [^5][^3][^4] |
| 5 | PostgreSQL RLS, if available | RLS gives defense in depth by enforcing row access inside the database. [^1][^2] |

The main decision is this: if your host does not provide PostgreSQL, do not block Phase D waiting for it.  Build the tenant/org model now on the shared server with app-level isolation, and either add managed PostgreSQL later for full RLS or keep the app-layer guardrails as your phase-one enforcement model.[^1][^2]

Would you like me to turn this into the exact schema and middleware plan for `tenants`, `tenant_domains`, `memberships`, and hostname resolution next?
<span style="display:none">[^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

[^2]: https://supabase.com/docs/guides/database/postgres/row-level-security

[^3]: https://github.com/WordPress/Advanced-administration-handbook/blob/main/server/subdomains-wildcard.md

[^4]: https://www.meinfoway.com/support/article/190/How-to-create-wildcard-subdomain-in-cPanel.html

[^5]: https://support.cpanel.net/hc/en-us/articles/4416167771543-How-to-create-wildcard-subdomains

[^6]: https://github.com/MicrosoftDocs/azure-databases-docs/blob/main/articles/cosmos-db/postgresql/concepts-row-level-security.md

[^7]: https://gist.github.com/ksanderer/8314c0bb39ba14cc31e0f600731dad23

[^8]: https://github.com/drizzle-team/drizzle-orm/discussions/2450

[^9]: https://github.com/orgs/supabase/discussions/3424

[^10]: https://github.com/MicrosoftDocs/sql-docs/blob/live/docs/relational-databases/security/row-level-security.md

[^11]: https://github.com/cloudpanel-io/cloudpanel-ce/discussions/273

[^12]: https://github.com/vercel/next.js/discussions/34787

[^13]: https://github.com/kysely-org/kysely/issues/330

[^14]: https://gist.github.com/kenvilar/99647c64770267ec5b9051971766390d

[^15]: https://github.com/prisma/prisma/discussions/6647

[^16]: https://github.com/Dandush03/pg_rls

[^17]: https://github.com/vercel/next.js/discussions/12234

[^18]: https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/database/postgres/row-level-security.mdx

[^19]: https://github.com/acmesh-official/acme.sh/issues/2992

[^20]: https://wiki.postgresql.org/wiki/Row-security

[^21]: https://satoricyber.com/postgres-security/postgres-row-level-security/

[^22]: https://www.enterprisedb.com/postgres-tutorials/how-implement-column-and-row-level-security-postgresql

[^23]: https://www.hostpapa.com/knowledgebase/create-wildcard-subdomain-cpanel/

[^24]: https://www.youtube.com/watch?v=emDCYo5Rz0E

[^25]: https://www.postgresql.org/docs/current/sql-createpolicy.html

[^26]: https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/

[^27]: https://www.reddit.com/r/SQL/comments/1merufb/postgresql_rowlevel_security_a_beginnerfriendly/

[^28]: https://www.reddit.com/r/node/comments/1gi25rh/how_shall_i_configure_nodejs_application_hosted/

[^29]: https://oneuptime.com/blog/post/2026-01-25-use-row-level-security-postgresql/view

[^30]: https://www.namecheap.com/support/knowledgebase/article.aspx/9191/29/how-to-create-a-wildcard-subdomain-in-cpanel/

