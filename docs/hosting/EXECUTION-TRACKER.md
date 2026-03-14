# Multiplic Integration Execution Tracker

Status date: 2026-03-12
Owner: AIISTECH Platform Team

## Current state

- Foundation docs and ADR chain exist in docs/adr (ADR-001 through ADR-009).
- Multiplic server, sync listener, CLI, and tests are in place.
- Registry supports static, proxy, and aiistech-namespaced entries.
- Multiplic Studio sub-app implemented through Phase 3 (auth, file system, git operations).
- 51 tests passing across 9 suites.

## Phase 0: Foundation (complete)

### Completed

- Added proxy registry entry for aiistech.com.
- Added proxy registry entry for api.aiistech.com.
- Updated config validation to accept proxy entries with required upstream.
- Updated router behavior to ignore proxy entries (static serving only).
- Added unit tests for proxy validation and proxy router behavior.
- Updated ADR-0006 status to Accepted to match implemented topology.
- Fixed mpc status crash on proxy entries (framework field absent for proxy type).
- Extended mpc add command to scaffold vite.config.js, index.html, main.jsx, App.jsx.

### Remaining

- Verify production Nginx uses infra/nginx/multiplic.conf topology exactly.
- Ensure app.aiistech.com and dashboard.aiistech.com dist artifacts are current.
- Execute curl validation from deployment environment.

## Phase 1: Identity layer (complete)

### Completed

- Backend exports app for testability.
- Integration tests for cookie-auth flow in mock-backend.
- Production startup guard requiring explicit JWT secrets.
- Environment-driven CORS allowlist parsing and deployment documentation.
- Login and refresh endpoint rate limiting (express-rate-limit).
- Structured JSON audit logs for auth and CORS rejection events.
- Contract tests for claim continuity after refresh.
- Browser-level cross-subdomain test path via Playwright.
- Root GitHub Actions staging workflow for cross-subdomain Playwright test.
- Centralized Loki and ELK auth audit mapping guide.
- Ready-to-apply Promtail config and ELK index template + Logstash pipeline.
- Branch protection guidance for staging check as required status check.
- Nightly schedule trigger (02:00 UTC) on staging Playwright workflow.

### Remaining

1. Configure staging GitHub secrets and run the staging workflow at least once.
2. Apply Loki or ELK mapping config in the active log pipeline.
3. Add rate-limit telemetry dashboard (429 counts by endpoint and origin).

## Phase 2 (Studio): Foundation + Auth + File System + Git (complete)

### ADRs written

- ADR-006: Password + session auth (bcryptjs + express-session)
- ADR-007: File system sandboxing (assertSafePath + deny-list)
- ADR-008: AI provider abstraction (pluggable SSE proxy)
- ADR-009: Terminal security (rbash + sanitized env + session limits)

### Completed

- Studio sub-app mounted conditionally at /_studio when STUDIO_PASSWORD is set.
- requireAuth middleware (session check, 401 JSON vs redirect).
- POST /_studio/auth/login (bcrypt compare, 300 ms delay on failure).
- POST /_studio/auth/logout (session destroy).
- Login page HTML (VSCode dark theme).
- Studio shell placeholder index.html.
- assertSafePath: path traversal rejection, symlink check, deny-list (.env, .git, node_modules).
- listDir / readFile (5 MB limit) / writeFile — all sandboxed.
- GET /api/fs/list, GET /api/fs/read, PUT /api/fs/write routes (auth-gated).
- gitOperations service (status, diff, commit, push via simple-git).
- GET /api/git/status, GET /api/git/diff, POST /api/git/commit, POST /api/git/push routes.
- terminalManager stub (node-pty optional; graceful 503 when absent).
- terminalRoutes + WebSocket upgrade handler (Phase 4).
- aiProvider factory (openai, anthropic, ollama, custom adapters).
- AI SSE route with context injection and per-session rate limiting.
- 28 Studio tests (4 files): requireAuth unit, assertSafePath unit, auth integration, studioMount integration.

### Remaining (Studio Phase 4–6)

1. Install node-pty on production server; terminal sessions will activate automatically.
2. Build React frontend (sites/multiplic-studio/) with Monaco editor, file explorer, git panel, terminal, AI chat sidebar.
3. Polish: VSCode keyboard shortcuts, dark theme finalization.

## Verification snapshot

- Hosting test suites: 9 passed, 0 failed.
- Total tests: 51 passed, 51 total.
- Mock backend auth tests: 9 passed, 9 total.

## Risks to track

- Lockfile drift currently prevents npm ci at hosting root; normalize before CI hardening.
- node-pty requires native compilation; install with node-gyp on production server.
