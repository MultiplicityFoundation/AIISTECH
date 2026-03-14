B — Auth Hardening: Move JWT tokens from localStorage to httpOnly cookies, add password hashing (bcrypt/argon2), implement OAuth2 (Google, GitHub), and add rate limiting/CSRF protection

Yes — and the first important correction is that the backend already contains part of Phase B: it is already issuing `access_token` and `refresh_token` as httpOnly cookies, using cookie-first auth, and applying custom rate limiting to login and refresh routes.  The gap is that the project status still lists token storage in `localStorage` as an active security blocker, which means the frontend, docs, or runtime behavior still need to be brought into alignment with the backend design.

## Current auth state

The current mock backend uses Express with `cookie-parser`, sets `access_token` and `refresh_token` cookies, verifies tokens from cookies before falling back to Bearer headers, and restricts cross-origin access with an allowlist that already anticipates `*.aiistech.com`.  It also has login and refresh rate limiters, audit logging, and logout cookie clearing already in place, so Phase B should be treated as a hardening and completion effort rather than a greenfield auth build.

The major weak points are still serious: users are stored in memory, passwords are plaintext, refresh tokens are not persisted for revocation, and the project status still flags token handling and production security as blockers.  That means the right plan is to keep the existing cookie-centered flow, then replace the fake identity store and add the missing protections around it.

## Shared-server approach

Because you are starting on a shared cPanel server with Node.js app support, database hosting, and DNS management, the safest plan is to avoid infrastructure that usually wants Redis, Kubernetes, or sidecar services in phase one. Your auth stack should stay within one Node app, one SQL database, one API subdomain such as `api.aiistech.com`, and one main app domain such as `app.aiistech.com`, which matches the backend's existing cookie/CORS approach.

That leads to this practical stack for Phase B on shared hosting: Express, Prisma with the server database, bcrypt or argon2 for password hashes, Passport or `openid-client` for Google and GitHub OAuth, SQL-backed session/refresh-token records, signed CSRF cookies, and HTTPS enforced through cPanel AutoSSL. The backend already has production-sensitive cookie options like `httpOnly`, `secure`, `sameSite`, domain scoping for `.aiistech.com`, and a refresh-cookie path, so the main task is making those settings reliable in the real deployed topology.

## Work breakdown

1. Frontend cookie alignment: remove any remaining access-token persistence in browser storage, switch API calls to `credentials: 'include'`, and update auth bootstrapping to rely on `/api/auth/me` plus `/api/auth/refresh` instead of reading tokens client-side.
2. Password security: replace the in-memory user object and plaintext password comparison with a real `users` table and hashed password verification, because the current backend compares the submitted password directly against `user.password`.
3. Refresh-token control: add a `sessions` or `refresh_tokens` table so every refresh token can be rotated, revoked on logout, and invalidated per device, instead of only trusting JWT validity.
4. CSRF protection: keep httpOnly cookies, add a CSRF token cookie plus header check for state-changing routes, and enforce origin/referrer validation for login, refresh, logout, and project mutations. The backend already has CORS origin filtering and credentialed requests, so CSRF should layer onto that instead of replacing it.
5. OAuth2 login: implement Google and GitHub login with callback routes on the same API domain, then map external identities into your `users` table and tenant membership model so OAuth users still fit the current `role` and `tenantId` payload shape.
6. Documentation and testing: update the status docs so they no longer contradict the cookie-based backend behavior, and add automated auth tests because the project status still says testing is manual-only.

## Milestones

Milestone 1 is stabilization: verify whether the frontend still uses `localStorage`, remove it, and make the current cookie flow work end to end in production using `https://app.aiistech.com` and `https://api.aiistech.com`.  Acceptance criteria: login works, refresh works, logout clears cookies, protected routes use `/api/auth/me`, and nothing auth-related is stored in `localStorage` or `sessionStorage`.

Milestone 2 is identity hardening: move users into SQL, hash passwords, add account lockout/backoff, and persist refresh tokens for revocation. The current login route, refresh route, and `generateTokens` helper give you a clean place to swap in the database layer without changing the frontend contract.

Milestone 3 is OAuth rollout: add `/api/auth/google`, `/api/auth/google/callback`, `/api/auth/github`, and `/api/auth/github/callback`, then either auto-link by email or use an `auth_accounts` table for provider identities. The current JWT payload already includes `id`, `email`, `role`, `tenantId`, and project slugs, so social login should end by issuing that same application identity model.

Milestone 4 is defensive controls: add CSRF middleware, `helmet`, stricter cookie policy checks, login anomaly logging, and better rate-limit storage if the shared host allows database-backed counters. The backend already emits structured auth audit logs and request IDs, which gives you a strong base for security event tracking.

## File-by-file changes

In `server.js`, keep the route structure but replace the `users` object, plaintext password comparison, and stateless refresh handling with Prisma-backed queries and hashed-password checks.  Also keep the existing cookie helpers, audit logging, request IDs, and CORS logic, because those are already aligned with a secure shared-domain deployment model.

Add new modules for `auth/service`, `auth/oauth`, `auth/csrf`, `auth/repository`, and `middleware/security`, because the current single-file backend is functional but too dense for production maintenance.  Add database tables for `users`, `refresh_sessions`, `oauth_accounts`, and optionally `login_attempts`, since the current app has enough auth complexity that persistence and separation are now worth it.

For the frontend, update the auth client so all protected requests send credentials, initial app load calls `/api/auth/me`, refresh is silent, and logout becomes server-authoritative. That change matches the backend's current cookie-first design and resolves the mismatch between the repo status notes and the implemented auth transport.

Should I turn this into a repo-ready implementation sequence with exact schema tables, route contracts, and the first set of files to create under `mock-backend/` or a new `backend/` folder?
<span style="display:none">[^1][^10][^11][^12][^13][^14][^15][^16][^17][^18][^19][^2][^20][^21][^22][^23][^3][^4][^5][^6][^7][^8][^9]</span>

<div align="center">⁂</div>

[^1]: https://github.com/neogcamp

[^2]: https://github.com/micromata/http-fake-backend

[^3]: https://github.com/weseek/bootcamp-frontend-mock-backend

[^4]: https://github.com/robinhosz/mock-api-server

[^5]: https://github.com/mohammedriyaz/api-simulator

[^6]: https://github.com/ai-multiply

[^7]: https://github.com/tomerfiliba-org/reedsolomon

[^8]: https://github.com/burt202/mocks-server-lite

[^9]: https://github.com/kmaork/madbg

[^10]: https://github.com/archtechx/tenancy

[^11]: https://github.com/PhilipAB/vsc-mock-backend

[^12]: https://github.com/multiplicitytech/multiplicitytech.github.io/blob/master/home.html

[^13]: https://github.com/MicrosoftDocs/visualstudio-docs/blob/main/docs/ide/visual-studio-github-copilot-troubleshoot.md

[^14]: https://github.com/topics/mock-backend

[^15]: https://github.com/multiplicitytech/multiplicitytech.github.io/activity

[^16]: https://toolhunt.io/themultiplicity-ai/

[^17]: https://docs.thebackend.io/sdk-docs/backend/base/multi-project-initialize/

[^18]: https://www.youtube.com/watch?v=K2R3hUo26bk

[^19]: https://github.com/multiplicitytech/multiplicitytech.github.io/milestones

[^20]: https://www.multitudes.co/help/apis

[^21]: https://www.reddit.com/r/node/comments/14foot9/mock_server/

[^22]: https://github.com/multiplicitytech/multiplicitytech.github.io/actions

[^23]: https://app.beeceptor.com/mock-server/dummy-json

