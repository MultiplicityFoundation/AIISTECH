<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Lets expand on this into a dev plan and for starters we are going to use a shared server, with c-panel and node.js app install capabilities, also has database capabilities and domain and dns management:

L — Subdomain Routing Engine: Build dynamic subdomain resolution at the edge (Cloudflare Workers or Next.js middleware) so client.aiistech.com routes to that tenant's published site

On a shared cPanel server, Phase L is mostly **host-header routing + a wildcard DNS entry**, with optional Cloudflare Workers in front later. The engine is: `hostname -> tenant -> published site`.

***

## 1. DNS and TLS prerequisites

- Create a wildcard subdomain `*.aiistech.com` in cPanel so all tenant subdomains hit the same app.[^1]
- Point `*.aiistech.com` to your cPanel account (A or CNAME).
- Enable SSL:
    - At minimum, use cPanel’s AutoSSL / Let’s Encrypt to cover `aiistech.com` and `*.aiistech.com`.[^2][^3]
    - If you later add Cloudflare in front, you can use Cloudflare for SaaS/custom hostnames to terminate SSL for custom domains and proxy to your origin.[^4][^5][^6]

This gives you a single origin where every `client.aiistech.com` request arrives with a different `Host` header.

***

## 2. Data model for routing

Extend what you started in Phases D–K:

- `tenant_domains`
    - `id`
    - `tenant_id`
    - `hostname` (e.g. `client.aiistech.com`, `app.customer.com`)
    - `type` (`'subdomain' | 'custom'`)
    - `status` (`'pending' | 'active' | 'error'`)
    - `primary_site_id` (points to the published site/page for that hostname)
    - timestamps
- `sites` (or reuse your `projects`/`pages` tables)
    - `id`
    - `tenant_id`
    - `kind` (`'dashboard' | 'marketing' | 'landing'`)
    - `published_version_id` (from your page/page_versions model)
    - `path_prefix` (optional, for routing under `/` or `/app`)

This lets your routing engine answer, “For this hostname and path, which tenant and which published site should I serve?”

***

## 3. Node-level routing engine (shared server friendly)

In your Node app (running under cPanel’s Node.js App):

1. **Hostname resolution middleware** (runs very early):

```ts
app.use(async (req, res, next) => {
  const host = req.headers.host?.split(':').toLowerCase();
  // Look up tenant_domains by host
  const domain = await findDomainByHostname(host);
  if (!domain || domain.status !== 'active') {
    return res.status(404).send('Tenant site not found');
  }
  req.tenantId = domain.tenant_id;
  req.siteId = domain.primary_site_id;
  next();
});
```

This is the core of a host-based multi-tenant router: one app, many hostnames, database-driven mapping. Cloudflare’s multi-tenant routing examples and Workers KV docs describe this general pattern (host/path → lookup → origin/handler).[^7][^8][^4]
2. **Site/page dispatch**:

After tenant resolution, add a second middleware that decides **what to serve**:
    - If path starts with `/api` → send to API router (auth, dashboards, etc.).
    - Else → treat as tenant site:
        - Use `req.siteId` and `req.path` to look up the appropriate published `page_version` for that path.
        - Render the stored HTML/CSS (from Phase H) or a dynamic React page using the stored schema.

Pseudocode:

```ts
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) return next();

  const site = await getSiteById(req.siteId);
  const page = await findPublishedPageForPath(site.id, req.path || '/');
  if (!page) return res.status(404).send('Page not found');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(page.html);
});
```

This approach works entirely on your shared server with no extra infra.

***

## 4. Optional Cloudflare Worker “edge router”

Later, when you’re ready to put Cloudflare in front, you can add a **single gateway Worker** on a wildcard route (e.g. `*.aiistech.com` and all custom hostnames) that:

- Reads the `Hostname` from the request.
- Optionally looks up routing info in Workers KV or via your API.[^7]
- Forwards the request to your cPanel origin, possibly rewriting the hostname or adding headers.

Example from Cloudflare Workers patterns (simplified):[^9][^7]

```js
export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Optionally: look up tenant/site in KV here and set headers
    url.hostname = 'origin.aiistech.com';
    return fetch(url.toString(), request);
  },
};
```

For a shared-server phase, this is **optional**. Your Node app alone can do all the host-based routing; Workers primarily add global edge latency benefits and tighter integration with Cloudflare for SaaS.[^8][^9][^4]

***

## 5. cPanel + wildcard details

- Configure `*.aiistech.com` as a wildcard subdomain in cPanel and ensure it points to the same document root / Node app as your main app.[^1]
- Once AutoSSL covers `*.aiistech.com`, **any** `client.aiistech.com` URL will:
    - Resolve via DNS to your server.[^10]
    - Terminate TLS with the wildcard cert.[^3][^2]
    - Hit your Node app, which then does host-header routing based on DB lookups.

This pattern—wildcard DNS + single app + host-based tenant routing—is the same one used in many multi-tenant SaaS examples on other platforms; Cloudflare’s docs and community examples mirror it closely.[^11][^12][^13][^10]

***

## 6. Milestones

1. **L1 – Wildcard subdomain + origin routing**
    - Set up `*.aiistech.com` in cPanel/DNS.
    - Add hostname → tenant/site lookup middleware.
    - Serve tenant-specific content for different subdomains from one app.
2. **L2 – Published-site integration**
    - Wire routing to your `pages` / `page_versions` from Phase H.
    - Ensure `tenant.aiistech.com` shows the tenant’s published home page.
3. **L3 – Custom domains**
    - Combine with Phase K: treat custom hostnames in `tenant_domains` exactly like subdomains, as long as DNS points to your origin (or Cloudflare for SaaS front).[^5][^4]
4. **L4 – Edge optimization (optional)**
    - Add a Cloudflare Worker gateway once you move DNS there, to keep routing decisions as close to the user as possible and integrate tightly with Cloudflare for SaaS.[^9][^4][^7]

On your current shared stack, L1–L3 are fully achievable without extra infrastructure; Workers and KV are an optimization step rather than a requirement.
<span style="display:none">[^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24][^25]</span>

<div align="center">⁂</div>

[^1]: https://support.cpanel.net/hc/en-us/articles/4416167771543-How-to-create-wildcard-subdomains

[^2]: https://support.cpanel.net/hc/en-us/community/posts/19139893500823--CPANEL-31544-How-to-install-a-Wildcard-SSL-Certificate-using-the-free-Let-s-Encrypt-provider-plugin

[^3]: https://docs.cpanel.net/knowledge-base/third-party/the-lets-encrypt-plugin/

[^4]: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/

[^5]: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/start/getting-started/

[^6]: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/domain-support/create-custom-hostnames/

[^7]: https://developers.cloudflare.com/kv/examples/routing-with-workers-kv/

[^8]: https://dev.to/alexisfranorge/dns-automation-for-multi-tenant-saas-on-cloudflare-2ag7

[^9]: https://stackoverflow.com/questions/78269073/cloudflare-pages-to-handle-all-subdomains-wildcard-record-for-custom-domain

[^10]: https://developers.cloudflare.com/dns/manage-dns-records/reference/wildcard-dns-records/

[^11]: https://github.com/ChrispyBacon-dev/DockFlare/wiki/UsingWildcardDomains.md

[^12]: https://answers.netlify.com/t/multi-tenant-application-is-it-possible-to-have-a-wildcard-domain-in-netlify/79724

[^13]: https://aws.amazon.com/blogs/mobile/wildcard-subdomains-for-multi-tenant-apps-on-aws-amplify-hosting/

[^14]: https://github.com/cloudflare/workers-sdk/issues/2082

[^15]: https://github.com/Azure/static-web-apps/issues/460

[^16]: https://gist.github.com/BoredHackerBlog/102ceb4ab226e3ba5cfc151e871e4f6e

[^17]: https://github.com/cloudflare/workers-oauth-provider/issues/70

[^18]: https://github.com/coollabsio/coolify/discussions/1948

[^19]: https://github.com/cloudflare/workers-sdk/issues/5568

[^20]: https://github.com/cloudflare/workers-sdk/issues/574

[^21]: https://github.com/orgs/vercel/discussions/4972

[^22]: https://github.com/coollabsio/coolify/discussions/3453

[^23]: https://www.answeroverflow.com/m/1419964194866073610

[^24]: https://workers.cloudflare.com/solutions/platforms

[^25]: https://www.linkedin.com/posts/morshedulmunna_saas-multitenant-cloudflare-activity-7426997121192718336-L6CN

