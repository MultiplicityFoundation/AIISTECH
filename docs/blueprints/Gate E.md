#E — Billing \& Subscriptions: Integrate Stripe for subscription tiers (Starter, Pro, Enterprise). Build a billing dashboard — the repo already has page-pricing.php and a billing route scaffolded

Yes — for a shared-server first release, Phase E should use **Stripe Checkout + Stripe Billing + Stripe Customer Portal**, with your cPanel-hosted Node backend acting as the control plane for sessions, webhooks, and billing state sync. Stripe’s Billing stack is designed for recurring plans, supports flat-rate through more advanced pricing models, and its hosted customer portal already covers subscription management and billing info updates, which makes it a strong fit for a lean first deployment.[^1][^2][^3]

## Product shape

AIISTECH already has a public pricing page file, `page-pricing.php`, and the project status says the dashboard `billing` route has been wired to live dashboard APIs, so you already have a natural split between a marketing pricing surface and an authenticated account-billing surface.  That means the dev plan should treat billing as two products: a public “choose plan” flow and a private “manage subscription” dashboard.

For version 1, define three Stripe products — Starter, Pro, and Enterprise — with monthly and annual prices, and map each to AIISTECH feature entitlements such as user limits, dashboard count, project count, integrations, and support level. Stripe’s subscription model is built around products, prices, and recurring subscription lifecycles, and Stripe’s docs also support provisioning product access based on subscription state or entitlements.[^4][^5]

## Shared-server architecture

On your shared server, keep the frontend and backend simple: serve the public site and dashboard UI from cPanel-managed hosting, and run one Node.js app for Stripe endpoints under something like `api.aiistech.com`. The current repo already includes a Node backend, existing auth/cookie infrastructure, and tenant-aware project concepts, so billing should plug into that API instead of becoming a separate service.

The backend should own five billing endpoints:

- `POST /api/billing/checkout-session`
- `POST /api/billing/portal-session`
- `POST /api/billing/webhook`
- `GET /api/billing/summary`
- `GET /api/billing/invoices`

This design fits Stripe’s recommended hosted flow, where your app creates Checkout sessions, creates customer portal sessions, and receives subscription event notifications through a webhook endpoint that must verify incoming Stripe events.[^2][^3][^6][^7]

## Delivery phases

**E1 — Catalog and schema.** Create database tables for `billing_customers`, `subscriptions`, `subscription_items`, `invoices`, and `plan_entitlements`, keyed to your tenant/org model so every tenant has one billing owner and one active subscription record. This aligns billing with the repo’s existing tenant-aware structure, where users and projects already carry `tenantId`.

**E2 — Checkout launch.** Wire the public pricing page, `page-pricing.php`, so plan buttons call the backend to create a Stripe Checkout session, then redirect to Stripe’s hosted payment page. Stripe’s subscription quickstart explicitly supports using Checkout for subscription sign-up, which is ideal for a shared-server phase because it minimizes custom PCI-sensitive payment handling.[^8][^3]

**E3 — Webhook sync.** Add a webhook endpoint that records checkout completion, subscription status changes, renewals, cancellations, and payment failures into your local billing tables. Stripe’s subscription docs say webhook handling is how your site should track active subscriptions, payment failures, and access changes, and Stripe also requires webhook signature verification.[^6][^7][^5]

**E4 — Customer self-service.** Add a “Manage Billing” button inside the app’s billing dashboard that creates a Stripe Customer Portal session and redirects the user there. Stripe’s customer portal lets customers manage subscriptions, update payment methods, view invoices, and change subscription status without you building those interfaces from scratch.[^9][^10][^2]

**E5 — Internal billing dashboard.** Use the existing billing route in the app to show plan name, subscription status, renewal date, invoice history, payment failures, and upgrade/downgrade actions. The repo already says the `billing` route is wired to live dashboard APIs, so this is a practical place to expose synced Stripe data rather than building a second admin panel.

## Repo changes

Use `page-pricing.php` as the public acquisition page and keep it optimized for plan comparison, FAQs, and “Start with Starter / Upgrade to Pro / Contact Sales for Enterprise.” The repo already contains that file, so Phase E can enhance an existing surface instead of adding a new public billing page from zero.

In the backend, add a dedicated billing module rather than placing Stripe logic directly inside the current single-file mock server. The current backend already centralizes auth, projects, and dashboard APIs in `mock-backend/server.js`, so billing is now large enough to justify `billing/routes`, `billing/service`, `billing/webhook`, and `billing/repository` modules.

## First release scope

For the first production billing release on shared hosting, keep the plan intentionally narrow:

- Fixed-price monthly and annual subscriptions only.
- One subscription per tenant.
- Stripe Checkout for sign-up.
- Stripe Customer Portal for self-service.
- Local dashboard mirrors Stripe status and invoice history.
- Enterprise handled as “contact sales” before fully automating negotiated contracts.

That scope matches Stripe’s fast path for subscription deployments and avoids overbuilding before AIISTECH clears its current production blockers around backend replacement, testing, and deployment readiness.[^3][^4]

## Acceptance criteria

Phase E is done when these are true:

- A visitor can select Starter or Pro on the pricing page and complete subscription sign-up through Stripe Checkout.[^3]
- A tenant admin can open a billing dashboard and see current plan, status, and invoice history from synced billing data.[^6]
- A tenant admin can open the Stripe customer portal to update payment methods or manage the subscription.[^9][^2]
- Webhook events update local billing state and access decisions after renewals, failures, cancellations, and plan changes.[^7][^5][^6]

The cleanest next step is to define the exact database schema and API contract for `checkout-session`, `portal-session`, `webhook`, and `billing summary` so Phase E can be implemented alongside the tenant model instead of after it.
<span style="display:none">[^11][^12][^13][^14][^15][^16][^17][^18][^19][^20][^21][^22][^23][^24][^25][^26][^27][^28][^29][^30]</span>

<div align="center">⁂</div>

[^1]: https://stripe.com/billing

[^2]: https://docs.stripe.com/customer-management

[^3]: https://docs.stripe.com/billing/quickstart

[^4]: https://docs.stripe.com/billing/subscriptions/build-subscriptions

[^5]: https://docs.stripe.com/billing/subscriptions/overview

[^6]: https://docs.stripe.com/billing/subscriptions/webhooks

[^7]: https://docs.stripe.com/webhooks

[^8]: https://github.com/stripe-samples/checkout-single-subscription

[^9]: https://stripe.com/blog/billing-customer-portal

[^10]: https://support.stripe.com/questions/billing-customer-portal

[^11]: https://github.com/pay-rails/pay/blob/main/docs/stripe/8_stripe_checkout.md

[^12]: https://github.com/stripe-samples/checkout-single-subscription/blob/main/README.md

[^13]: https://github.com/stripe-samples/subscription-use-cases

[^14]: https://github.com/justalever/stripe_checkout_portal

[^15]: https://github.com/dj-stripe/dj-stripe/issues/1080

[^16]: https://github.com/jomweb/billplz

[^17]: https://github.com/stripe-archive/checkout-subscription-and-add-on

[^18]: https://github.com/stripe/stripe-cli/issues/418

[^19]: https://github.com/mollie/laravel-mollie

[^20]: https://github.com/hkhanna/django-stripe-billing

[^21]: https://github.com/invertase/stripe-firebase-extensions/issues/53

[^22]: https://github.com/chrisboulton/php-resque

[^23]: https://github.com/stripe-samples/checkout-single-subscription/blob/main/server/dotnet/Controllers/PaymentsController.cs

[^24]: https://gist.github.com/natanfeitosa/8aef22c8bf8660f65811ec60e8375d38

[^25]: https://vapecloud.co.nz/pages/faq

[^26]: https://fumoindustries.com/index.php?route=information%2Finformation\&information_id=5

[^27]: https://www.youtube.com/watch?v=ag7HXbgJtuk

[^28]: https://docs.stripe.com/subscriptions

[^29]: https://www.alisbh.com/blog/php-treatment-program/

[^30]: https://docs.stripe.com/api/events/types

