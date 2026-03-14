C — CI/CD \& Hosting: Deploy frontend to Vercel/Cloudflare Pages, backend to Railway/Fly.io/AWS ECS, enable HTTPS with auto-SSL, set up GitHub Actions for lint → test → build → deploy pipeline

Yes — for **stage 1**, I would replace the original “frontend on Vercel / backend on Railway-Fly-ECS” plan with a single shared-hosting deployment model centered on cPanel, because your repo is still marked “deployment not ready,” the backend is still mock-only, and testing is still mostly manual.  AIISTECH already has the pieces needed to grow into this setup — a Vite frontend, a `mock-backend` Node service, a `.github` folder, an `infra` folder, and Playwright configuration — so the right move is to build a lean CI/CD pipeline around what is already there rather than introduce multi-provider hosting too early.

## Hosting model

For the first production-capable phase, host the frontend and backend on the same shared server under separate subdomains such as `app.aiistech.com` and `api.aiistech.com`, managed through cPanel DNS and Node.js app support. That fits the backend’s current production-oriented cookie and CORS design, which already anticipates `*.aiistech.com` origins and cookie-based auth across the domain.

Use cPanel for three concerns only: static frontend hosting, Node app process management for the API, and database/domain management. Keep the architecture simple — one GitHub repo, one shared server, one database, one TLS-managed domain footprint — until the production blockers in the repo status are cleared.

## Environment layout

I recommend a three-environment path even on shared hosting: local, staging, and production. Since the repo already distinguishes development from production concerns and explicitly says production testing is still required, staging should live on a separate subdomain such as `staging.aiistech.com` with `api-staging.aiistech.com` so you can validate builds before publishing them live.


| Environment | Frontend host | Backend host | Purpose |
| :-- | :-- | :-- | :-- |
| Local | Vite dev server | Node local server | Fast development against the current app structure. |
| Staging | `staging.aiistech.com` | `api-staging.aiistech.com` | Validate auth, deploy flow, and dashboard integration before release. |
| Production | `app.aiistech.com` | `api.aiistech.com` | Serve the live platform with SSL, database, and managed DNS. |

## Pipeline design

The GitHub Actions pipeline should be: `lint -> unit/integration test -> frontend build -> backend smoke test -> package artifacts -> deploy to staging -> manual approval -> deploy to production`. That sequence is justified by the repo’s current state: the project status calls out missing automated tests and not-ready deployment, while the root already includes Playwright config and a `.github` directory that can host workflow files.

For stage 1, deploy by artifact copy rather than containers. Build the frontend into static files for cPanel hosting, then deploy the backend source plus production dependencies to the Node app directory, because the current backend is a straightforward Node/Express service rather than a container-first stack.

## GitHub Actions plan

Create four workflows in `.github/workflows`: `ci.yml`, `deploy-staging.yml`, `deploy-production.yml`, and `rollback.yml`. The repo already has the scaffolding for CI adoption through its `.github` folder and Playwright config, but the status document makes clear that automated testing and production deployment need to be formalized.

A practical `ci.yml` for this repo should run:

- Frontend: `npm ci`, `npm run lint`, `npm run build`.
- Backend: install `mock-backend` dependencies, run auth/API tests, and hit `/api/health` in a smoke-test job.
- E2E: run Playwright against staging once the staging deploy is complete, since Playwright is already configured in the repo.


## Deployment sequence

The rollout order should be: 1) create staging and production subdomains in cPanel, 2) provision the Node.js app(s), 3) connect the database, 4) automate staging deploys from GitHub, 5) add manual promotion to production, and 6) add backups and rollback. That order directly addresses the repo’s current blockers around deployment readiness, monitoring gaps, and production testing not yet being complete.

For deployment mechanics, use one of these stage-1 options: Git push on server, SFTP/rsync from GitHub Actions, or cPanel Git Version Control if your host supports it. The simplest reliable model is “build in GitHub Actions, upload artifact, restart Node app in cPanel,” because it avoids adding external platforms while AIISTECH is still transitioning from a mock backend to a real hosted service.

## Milestones

Phase C on shared hosting should be broken into four milestones:

- **C1**: Staging live on cPanel with SSL and manual deploys.
- **C2**: GitHub Actions CI green on lint, build, backend smoke tests, and Playwright.
- **C3**: Automated staging deploy plus manual production approval.
- **C4**: Backups, rollback, uptime checks, and log capture.

That keeps infrastructure proportional to the repo’s maturity, which today is “development complete, production pending,” with deployment still marked not ready and the backend still mock-only.  Once those are stable, you can revisit a split-host architecture later without redoing the app-level work. Would you like the next step to be a concrete `.github/workflows` file plan and cPanel directory structure?
<span style="display:none">[^1][^10][^11][^12][^13][^14][^15][^16][^17][^2][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://github.com/multiplicitytech/multiplicitytech.github.io/actions

[^2]: https://github.com/actions/starter-workflows/actions

[^3]: https://github.com/PR-Pilot-AI/smart-workflows

[^4]: https://github.com/ISUE/Multiwave/actions

[^5]: https://github.github.com/gh-aw/patterns/multirepoops/

[^6]: https://github.com/Ashish-Bansal/playwright-mcp/blob/main/package.json

[^7]: https://gist.github.com/githubfoam/66c9b8e08498867df393a600a290de45

[^8]: https://github.github.com/gh-aw/blog/2026-01-13-meet-the-workflows-multi-phase/

[^9]: https://github.com/cpave3/ag-grid-playwright/blob/main/package.json

[^10]: https://github.com/karpathy/nanoGPT

[^11]: https://github.com/ethereum/EIPs/blob/master/EIPS/eip-7702.md

[^12]: https://github.com/module-federation/vite/blob/main/playwright.config.ts

[^13]: https://github.com/foamliu/Deep-Image-Matting

[^14]: https://github.com/Drive4ik/simple-tab-groups/issues/469

[^15]: https://github.com/brandonroberts/analog-playwright-component-tests/blob/main/package.json

[^16]: https://github.com/AutomaApp/automa

[^17]: https://github.com/expo/expo/issues/16202

