<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Lets expand on this into a dev plan and for starters we are going to use a shared server, with c-panel and node.js app install capabilities, also has database capabilities and domain and dns management:

I — Component Library Expansion: The existing components/ directory and components.json (shadcn registry) becomes the foundation for a client-facing UI kit — extend it with business-specific blocks (hero sections, pricing tables, testimonial sliders, contact forms)

For Phase I on a shared server, treat **components/** + **components.json** as the internal design system, and build a thin layer on top that exposes those primitives as **business blocks** you can use both in the dashboard and in the page builder.

***

## 1. Goals and constraints

- Keep all design tokens, typography, spacing, and base components in your existing shadcn-style library (buttons, cards, inputs, modals).
- Add a separate “blocks” layer that assembles those primitives into business-ready sections (hero, pricing, testimonials, contact forms).
- Make blocks usable in:
    - The React app (marketing pages, dashboard surface).
    - The GrapesJS-based page builder (Phase H) via custom block definitions.

On a shared cPanel server, this is all **build-time frontend work** — no infra changes.

***

## 2. Structure in the repo

Under `components/`, add:

- `components/ui/…` — keep your current shadcn primitives (unchanged).
- `components/blocks/…` — new business blocks:
    - `HeroPrimary.tsx`
    - `HeroSplit.tsx`
    - `PricingTable.tsx`
    - `TestimonialsSlider.tsx`
    - `ContactForm.tsx`
    - `FeatureGrid.tsx`
    - `FAQAccordion.tsx`

Add a registry file:

- `components/blocks/registry.ts`
    - Exports a map: `{ id, name, description, category, component, defaultProps }[]`.
    - Example entry: `id: "hero-primary", category: "Hero", component: HeroPrimary`.

This registry is what both the React app and the builder integrate against.

***

## 3. Business block design

Each block should:

- Accept a simple `props` object with content and configuration:
    - Hero: `headline`, `subheadline`, `primaryCta`, `secondaryCta`, `image`, `alignment`.
    - Pricing: array of plans with `name`, `price`, `features`, `ctaLabel`.
    - Testimonials: array of quotes with `name`, `role`, `company`, `avatar`.
    - Contact form: fields, submit URL, success message.
- Use only your `ui` components (Button, Card, Input, etc.), so visual consistency is automatic.

You can then serialize block instances as:

```json
{
  "blockId": "hero-primary",
  "props": {
    "headline": "Automate your business operations.",
    "subheadline": "AIISTECH orchestrates everything for you.",
    "primaryCta": "Get started",
    "secondaryCta": "Talk to sales"
  }
}
```

That JSON shape is exactly what the page builder (Phase H) and dashboard layout (Phase G) can embed as `widgets_json` or `schema_json` entries.

***

## 4. Integration with the page builder (Phase H)

For GrapesJS, expose your React blocks as editor blocks:

- Define block types in GrapesJS’ Block Manager that correspond to your registry IDs (e.g. `block-hero-primary`, `block-pricing-table`).[^1][^2]
- When a user drops a block into the page, store:
    - The block ID (`hero-primary`).
    - A props JSON payload (default or edited).
- In your preview/rendering, map block IDs back to React components using the registry and render them on the server or client with the stored props.

This mirrors patterns in GrapesJS integrations where custom blocks map to higher-level components and are saved as JSON in a remote storage source, matching your DB-backed schema.[^3][^4][^1]

***

## 5. Integration with dashboards (Phase G)

Use the same blocks for “marketing-like” surfaces inside the app:

- Home dashboard: use `HeroPrimary` and `FeatureGrid` to highlight key product capabilities.
- In-app onboarding: use `FeatureGrid`, `FAQAccordion`.
- Tenant-specific “portal” pages: combine business blocks with KPI widgets.

Because the dashboard builder in Phase G stores widget configs separately, you can introduce a `CONTENT_BLOCK` widget type that renders one of these blocks with a given props payload.

***

## 6. Delivery plan

1. **I1 — Audit and group existing components**
    - List all `components/` primitives (buttons, cards, grids, forms) from the repo.
    - Decide which ones are the canonical building blocks (ui library).
2. **I2 — Design and implement core blocks**
    - Implement 5–8 blocks:
        - HeroPrimary, HeroSplit
        - PricingTable
        - TestimonialsSlider
        - ContactForm
        - FeatureGrid
        - FAQAccordion
3. **I3 — Create the block registry**
    - `blocks/registry.ts` with metadata, component references, and default props.
    - Export types for `BlockDefinition` and `BlockInstance`.
4. **I4 — Wire into builder and app**
    - In the page builder, map registry entries to GrapesJS blocks.
    - In the app, create a “Blocks Gallery” page for quick preview and QA.
5. **I5 — Theming and tenant overrides**
    - Later, allow tenants to override text, colors, and images per block instance via block props, while still using the same base components and layout.

***

## 7. Acceptance criteria

Phase I is complete when:

- There is a documented `components/blocks` layer built on your existing ui components.
- Block definitions are registered in one place and can be referenced by ID.
- The page builder can add/remove at least Hero, Pricing, Testimonials, and Contact blocks.
- Published pages render those blocks using stored JSON props, not hardcoded HTML.

Would you like the next step to be a concrete `BlockDefinition` TypeScript type and an example `HeroPrimary` + registry entry you can drop directly into `components/blocks/`?

<div align="center">⁂</div>

[^1]: https://grapesjs.com/docs/modules/Blocks.html

[^2]: https://github.com/GrapesJS/grapesjs

[^3]: https://grapesjs.com/docs/modules/Storage.html

[^4]: https://github.com/beepsoft/grapesjs-react-component-example

