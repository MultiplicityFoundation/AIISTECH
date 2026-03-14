K — Custom Domain Mapping: Allow clients to point their own existing domains to platform-hosted sites. Automate TLS cert provisioning via Let's Encrypt / Cloudflare Workers

For Phase K on a shared cPanel server, use a “**point your domain → we handle the rest**” model: tenants CNAME their domain to your platform, and you automate TLS + routing either via cPanel AutoSSL (for your own domains) plus Cloudflare for SaaS or via pure cPanel wildcard for the `*.aiistech.com` side.[^1][^2][^3]

***

## 1. Target experience

For a tenant admin in AIISTECH:

1. They go to **Settings → Domains**.
2. Click **“Connect custom domain”**.
3. Enter `app.client.com` (or `client.com`).
4. AIISTECH shows:
    - A DNS record they must add (typically CNAME `app.client.com` → `tenant.aiistech.com` or a Cloudflare SaaS CNAME target).[^4][^3][^5]
    - Verification TXT records when needed.
5. Once DNS is correct and SSL is issued, the domain shows as **Active**, and hitting `https://app.client.com` serves that tenant’s site.

***

## 2. DNS and routing foundations

On your shared server + cPanel:

- Create a **wildcard subdomain** `*.aiistech.com` pointing to your app document root so any `tenant.aiistech.com` hits your Node/React app stack. cPanel supports wildcard subdomains; you create a `*` subdomain and cPanel adds the wildcard DNS A record.[^6][^7][^8][^1]
- Use your existing tenant-domain mapping (Phase J + D): request hostname → look up in `domains` / `tenant_domains` → get tenant ID → serve the correct tenant site.

This gives you a stable **origin** for Cloudflare or a direct-mapping target for client domains.

***

## 3. TLS strategy on shared hosting

You have two realistic options:

1. **cPanel AutoSSL for your own domains (`*.aiistech.com`)**
    - Use cPanel’s Let’s Encrypt provider to issue a wildcard SSL for `*.aiistech.com` (works when cPanel manages the DNS zone).[^2][^9][^1]
    - This secures all tenant subdomains like `tenant.aiistech.com` out of the box.
2. **Cloudflare for SaaS for customer-owned domains**
    - Put `aiistech.com` (or another zone) on Cloudflare.
    - Use **Custom Hostnames / Cloudflare for SaaS**: each customer’s `app.client.com` becomes a “custom hostname” pointing to your origin (`origin.aiistech.com` or similar), and Cloudflare automatically issues and manages the SSL certificate.[^10][^3][^5][^4]
    - Cloudflare handles DCV (domain control validation) via TXT / HTTP challenges, and your app just needs to know the hostname → tenant mapping.

For a shared server and many customer domains, Cloudflare for SaaS is typically easier than automating Let’s Encrypt for arbitrary customer domains on cPanel, which would otherwise require DNS-01 validation per domain.[^3][^5][^4][^10]

***

## 4. Data model extensions

Building on Phase J’s `domains` table, add:

- `domains`
    - `id`
    - `tenant_id`
    - `hostname` (e.g. `app.client.com`)
    - `type` (`'custom' | 'platform'`)
    - `status` (`'pending_dns' | 'pending_ssl' | 'active' | 'error'`)
    - `cf_custom_hostname_id` (if using Cloudflare for SaaS)[^11][^4][^10][^3]
    - `last_error`
    - timestamps

You already have `tenant_id` from the org model; `hostname` becomes the key for routing, and `cf_custom_hostname_id` (or similar) lets you query Cloudflare’s status.[^11][^4][^3]

***

## 5. Backend flows (Node app)

Add a **Custom Domains** service with these key operations:

1. **Start onboarding**
    - `POST /api/domains/custom`
    - Auth: tenant admin only.
    - Body: `{ hostname }`.
    - Validates format, checks uniqueness, creates `domains` row with `status='pending_dns'`.
    - If using Cloudflare for SaaS:
        - Call Cloudflare Custom Hostnames API to create a custom hostname with appropriate SSL settings (TXT DCV recommended).[^4][^10][^3][^11]
        - Store `cf_custom_hostname_id`.
        - Return DNS instructions to the client (ownership TXT record, optional SSL TXT record, CNAME target) as Cloudflare docs and SDK examples show.[^12][^10][^3][^4]
2. **Provide DNS instructions**
    - `GET /api/domains/:id/instructions`
    - Returns a structured list: TXT and CNAME records the user must set, similar to the “DNS instructions” pattern in Cloudflare SaaS examples.[^12][^10][^3][^4]
3. **Poll domain status**
    - `GET /api/domains/:id/status`
    - Calls Cloudflare to read custom hostname status and SSL status: `pending`, `active`, `blocked`, etc.[^10][^3][^11][^4]
    - Updates local `status` (`pending_dns` → `pending_ssl` → `active` or `error`).
4. **Routing middleware**
    - On every incoming request, use `req.hostname` to find a matching `domain` record and derive `tenant_id` → route to the right tenant site.
    - This works for both `tenant.aiistech.com` and `app.client.com`.

***

## 6. UI in the AIISTECH dashboard

Create a **Custom Domains** panel:

- “Add domain” form → calls `POST /api/domains/custom`.
- Shows status chips: `DNS not verified`, `SSL pending`, `Active`.
- Shows DNS instructions (TXT + CNAME) with “Copy” buttons so users can configure their DNS provider.[^3][^4]
- Optional “Check status” button or auto-refresh that hits your status endpoint and updates.

***

## 7. cPanel and Cloudflare interplay

One viable shared-server architecture:

- **Origin**: cPanel Apache/Node app at `origin.aiistech.com`, protected by a standard Let’s Encrypt certificate (issued via AutoSSL).[^1][^2]
- **Platform subdomains**: `*.aiistech.com` served directly (or through Cloudflare but still using your wildcard cert).[^2][^1]
- **Customer custom domains**: configured as **Cloudflare Custom Hostnames** mapping to `origin.aiistech.com`. Cloudflare terminates SSL for each custom hostname and proxies traffic to your cPanel origin over HTTPS.[^5][^4][^10][^3]

This way:

- You only manage one certificate on the cPanel side (`origin.aiistech.com` or `*.aiistech.com`).
- Cloudflare manages per-customer certificates and DNS validation.[^4][^10][^3]

***

## 8. Milestones

1. **K1 – Routing without SSL automation**
    - Map `hostname` → `tenant` in DB.
    - Accept requests on both `tenant.aiistech.com` and manually configured `app.client.com` (using a static SSL).
2. **K2 – cPanel wildcard SSL for `*.aiistech.com`**
    - Enable Let’s Encrypt AutoSSL wildcard for your primary domain so all tenant subdomains are secure.[^9][^1][^2]
3. **K3 – Cloudflare for SaaS integration**
    - Set up Cloudflare zone.
    - Implement Create/Read operations for Custom Hostnames via API.[^11][^10][^3][^4]
    - Surface DNS instructions in the UI.
4. **K4 – Full onboarding UX**
    - Add in-app flows, status polling, and meaningful error messages.
    - Enforce that only `status='active'` custom domains are used for redirects/links.

On your current shared-server stack, I would start with wildcard SSL + subdomain routing, then add Cloudflare SaaS-based custom domains once Phase J’s domain table and DNS flows are stable.
<span style="display:none">[^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23]</span>

<div align="center">⁂</div>

[^1]: https://support.cpanel.net/hc/en-us/community/posts/19139893500823--CPANEL-31544-How-to-install-a-Wildcard-SSL-Certificate-using-the-free-Let-s-Encrypt-provider-plugin

[^2]: https://docs.cpanel.net/knowledge-base/third-party/the-lets-encrypt-plugin/

[^3]: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/

[^4]: https://dev.to/alexisfranorge/dns-automation-for-multi-tenant-saas-on-cloudflare-2ag7

[^5]: https://community.fly.io/t/custom-hostnames-on-cloudflare-saas/20650

[^6]: https://support.cpanel.net/hc/en-us/articles/4416167771543-How-to-create-wildcard-subdomains

[^7]: https://www.hostpapa.com/knowledgebase/create-wildcard-subdomain-cpanel/

[^8]: https://www.meinfoway.com/support/article/190/How-to-create-wildcard-subdomain-in-cPanel.html

[^9]: https://community.letsencrypt.org/t/wild-card-ssl-cpanel-support/59137

[^10]: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/create-custom-hostnames/

[^11]: https://github.com/cloudflare/cloudflare-go/blob/v0/custom_hostname.go

[^12]: https://github.com/cloudflare/cloudflare-go/blob/v0/custom_hostname_test.go

[^13]: https://github.com/SAP-samples/btp-cap-multitenant-saas/blob/main/docu/4-expert/-CloudFoundry-/custom-domain-usage/README.md

[^14]: https://github.com/outroll/vesta/issues/1567

[^15]: https://github.com/cloudflare/workers-sdk/issues/8271

[^16]: https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/docs/dns/nameservers/custom-nameservers/tenant-custom-nameservers.mdx

[^17]: https://gist.github.com/namndev/15aa52b87c99f24b676cffa02da35769

[^18]: https://github.com/archtechx/tenancy

[^19]: https://github.com/EasyEngine/easyengine/issues/668

[^20]: https://github.com/cloudflare/cloudflare-docs/blob/production/content/tenant/get-started/index.md

[^21]: https://www.reddit.com/r/CloudFlare/comments/1ci9rcp/how_to_add_custom_hostname_for_multi_tenant/

[^22]: https://www.linkedin.com/posts/morshedulmunna_saas-multitenant-cloudflare-activity-7426997121192718336-L6CN

[^23]: https://lobehub.com/skills/neversight-skills_feed-multi-tenant-platform-architecture

