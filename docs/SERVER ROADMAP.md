## What We're Working With

The mock backend is a single `server.js` file running Express on port 3001 . It already has solid architecture bones: httpOnly cookie auth, rate limiting, audit logging, JWT refresh rotation, a CORS whitelist for `*.aiistech.com`, role-based dashboard data, and a provisioning saga engine for project deployment . The only things that are fake are the **user store** (in-memory JS object with plaintext passwords), the **projects store** (in-memory), and all **dashboard data** (hardcoded) . The migration is surgical — the structure stays, the data layer gets replaced.

***

## Step 1 — cPanel Node.js App Setup

Before touching any code, configure the server environment.

- Log into cPanel → **Setup Node.js App** → Create New Application
- Set **Node.js version** to 20.x LTS (minimum 18.x required for Prisma)
- Set **Application root** to something like `/home/username/aiistech-api`
- Set **Application URL** to `api.aiistech.com` (you'll create this subdomain in cPanel DNS)
- Set **Application startup file** to `server.js`
- Set **Node environment** to `production`
- cPanel will give you an `npm install` button and a **Restart** control — use these instead of CLI for shared hosting

After creation, SSH into the server and navigate to the app root. cPanel Node.js apps use a **Phusion Passenger** wrapper, so your `server.js` must **not** call `app.listen()` when run by Passenger — it should export the Express `app` instead. The mock backend already does this correctly: `if (require.main === module) { app.listen(...) }` and `module.exports = { app }` . That's already Passenger-compatible.

***

## Step 2 — Database Setup in cPanel

cPanel's database wizard (MySQL/MariaDB) is what's available on shared hosting — but **Prisma works with MySQL**, so we use that instead of PostgreSQL.

### Create the Database

1. cPanel → **MySQL Databases** → Create database: `aiistech_prod`
2. Create database user: `aiistech_user` with a strong password
3. Add user to database with **All Privileges**
4. Note the host (usually `localhost` or `127.0.0.1`)

### Prisma Schema (MySQL flavor)

Create `/home/username/aiistech-api/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model Tenant {
  id        String   @id @default(uuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]
  projects  Project[]
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  firstName    String
  lastName     String
  role         UserRole
  isActive     Boolean  @default(true)
  tenantId     String
  tenant       Tenant   @relation(fields: [tenantId], references: [id])
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  sessions     Session[]
  projects     Project[]
}

model Session {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshToken String   @unique @db.Text
  ipAddress    String?
  userAgent    String?  @db.Text
  expiresAt    DateTime
  createdAt    DateTime @default(now())
}

model Project {
  id          String        @id @default(uuid())
  slug        String        @unique
  name        String
  tenantId    String
  tenant      Tenant        @relation(fields: [tenantId], references: [id])
  ownerId     String
  owner       User          @relation(fields: [ownerId], references: [id])
  status      ProjectStatus @default(UNDEPLOYED)
  url         String?
  deployedAt  DateTime?
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

enum UserRole {
  EXECUTIVE
  FINANCE
  OPERATIONS
  IT
  ADMIN
}

enum ProjectStatus {
  UNDEPLOYED
  PROVISIONING
  DEPLOYED
  FAILED
  TEARDOWN
}
```

This schema directly mirrors the in-memory data structures in the mock server , making the migration a 1:1 replacement of object lookups with Prisma queries.

***

## Step 3 — Production Dependencies

Update `mock-backend/package.json` (or create a dedicated `backend/package.json`):

```json
{
  "name": "aiistech-api",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "db:migrate": "npx prisma migrate deploy",
    "db:seed": "node prisma/seed.js",
    "db:studio": "npx prisma studio"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "jsonwebtoken": "^9.0.2",
    "cookie-parser": "^1.4.6",
    "bcryptjs": "^2.4.3",
    "@prisma/client": "^5.10.0",
    "express-rate-limit": "^7.2.0",
    "helmet": "^7.1.0",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "prisma": "^5.10.0"
  }
}
```

Key additions vs. the current mock: `bcryptjs` replaces plaintext passwords, `helmet` adds security headers, `express-rate-limit` replaces the hand-rolled rate limiter (keep the existing one or swap — both work), and `@prisma/client` replaces the in-memory `users` and `projects` objects .

***

## Step 4 — Environment Variables in cPanel

cPanel's Node.js app panel has an **Environment Variables** section — add these directly there (never commit them to git):

```
NODE_ENV=production
PORT=3001
DATABASE_URL=mysql://aiistech_user:YOUR_PASSWORD@localhost:3306/aiistech_prod
JWT_SECRET=<generate: openssl rand -base64 64>
JWT_REFRESH_SECRET=<generate: openssl rand -base64 64>
CORS_ALLOWED_ORIGINS=https://aiistech.com,https://app.aiistech.com
AUTH_AUDIT_LOGS=true
```

The mock server already reads all of these from `process.env` with sensible fallbacks , so no code changes needed here — just populate the real values.

***

## Step 5 — Rewrite the Data Layer in `server.js`

This is the core migration. Each in-memory lookup becomes a Prisma query. The API contract stays identical — the frontend sees no change.

### Auth: Replace Plaintext Password Check

**Before (mock):**

```js
// plaintext comparison — REMOVE THIS
if (!user || user.password !== password) { ... }
```

**After (production):**

```js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// In POST /api/auth/login:
const user = await prisma.user.findUnique({ where: { email } });
if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
  return res.status(401).json({ message: 'Invalid email or password' });
}
```


### Auth: Store Refresh Tokens in DB (Session Table)

Instead of stateless JWT refresh tokens (which can't be revoked), write to the `Session` table on login and validate against it on refresh:

```js
// On login — create session
const session = await prisma.session.create({
  data: {
    userId: user.id,
    refreshToken: refreshToken,
    ipAddress: getClientIp(req),
    userAgent: req.headers['user-agent'],
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }
});

// On refresh — validate session exists and isn't expired
const session = await prisma.session.findUnique({ where: { refreshToken } });
if (!session || session.expiresAt < new Date()) {
  return res.status(401).json({ message: 'Invalid or expired refresh token' });
}
// Rotate: delete old, create new
await prisma.session.delete({ where: { id: session.id } });
```


### Projects: Replace In-Memory Store

**Before:**

```js
const projects = {};  // in-memory — lost on restart
projects[slug] = project;
```

**After:**

```js
// POST /api/projects
const project = await prisma.project.create({
  data: { id: randomUUID(), slug, name, tenantId: req.user.tenantId, ownerId: req.user.id }
});

// GET /api/projects
const projects = await prisma.project.findMany({
  where: { tenantId: req.user.tenantId }
});

// GET /api/projects/:slug
const project = await prisma.project.findUnique({ where: { slug: req.params.slug } });
```


### Dashboard: Replace Hardcoded Data

The dashboard endpoints currently return hardcoded KPI objects per role . In production, these pull from real DB tables. For the **immediate migration**, the priority is getting auth and projects live — dashboard data can be replaced incrementally. Create a `DashboardMetric` table in Prisma later, or connect to real data sources (automation logs, billing records) in Phase N of the broader roadmap.

***

## Step 6 — Seed Script

Create `prisma/seed.js` to seed the same 4 demo users from the mock, now with hashed passwords:

```js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'aiistech-internal' },
    update: {},
    create: { id: 'tenant-1', name: 'AIISTECH Internal', slug: 'aiistech-internal' }
  });

  const demoUsers = [
    { email: 'exec@aiistech.com', firstName: 'John', lastName: 'Executive', role: 'EXECUTIVE' },
    { email: 'finance@aiistech.com', firstName: 'Sarah', lastName: 'Finance', role: 'FINANCE' },
    { email: 'ops@aiistech.com', firstName: 'Mike', lastName: 'Operations', role: 'OPERATIONS' },
    { email: 'it@aiistech.com', firstName: 'Alice', lastName: 'Tech', role: 'IT' },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        ...u,
        passwordHash: await bcrypt.hash('password123', 12),
        tenantId: tenant.id
      }
    });
  }
  console.log('✅ Seed complete');
}

main().catch(console.error).finally(() => prisma.$disconnect());
```


***

## Step 7 — DNS \& Subdomain for the API

In cPanel:

1. **Subdomains** → Create `api.aiistech.com` pointing to the Node.js app root
2. cPanel → **SSL/TLS** → AutoSSL → Run for `api.aiistech.com` (free Let's Encrypt cert)
3. The Node.js app in Passenger will now serve at `https://api.aiistech.com`

Update the frontend's API base URL in `.env.production`:

```
VITE_API_URL=https://api.aiistech.com
```


***

## Step 8 — Deployment Checklist

Run these in order via SSH or cPanel's Terminal:

```bash
# 1. Navigate to app root
cd ~/aiistech-api

# 2. Install dependencies (or use cPanel's npm install button)
npm install

# 3. Generate Prisma client
npx prisma generate

# 4. Run migrations (creates all tables)
npx prisma migrate deploy

# 5. Seed the database
node prisma/seed.js

# 6. Restart app in cPanel Node.js panel
# (cPanel restart button — Passenger picks up changes)
```


***

## Step 9 — Validate Before Switching Frontend

Before pointing the live frontend at the new API, test every endpoint. The existing `mock-backend/tests/` directory  is the place to expand with real integration tests using Jest + Supertest:

```bash
# Test login
curl -X POST https://api.aiistech.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"exec@aiistech.com","password":"password123"}' \
  -c cookies.txt

# Test auth/me using cookie
curl https://api.aiistech.com/api/auth/me -b cookies.txt

# Test health
curl https://api.aiistech.com/api/health
```


***

## Step 10 — Frontend Switch \& Cleanup

Once the API passes validation:

1. Update `VITE_API_URL` in Vite config / `.env.production` to `https://api.aiistech.com`
2. Rebuild frontend: `npm run build`
3. Deploy build output to `public_html` (or a subdirectory) via cPanel File Manager or Git
4. Archive (don't delete yet) `mock-backend/server.js` — rename to `server.mock.js` for reference
5. Remove the demo password `password123` reminder from all docs

***

## What This Unlocks

Once Phase A is complete with this stack, every subsequent phase from the full roadmap has a real foundation:


| Phase | Now Possible |
| :-- | :-- |
| B — Auth Hardening | Sessions table is live; httpOnly cookies already set |
| D — Multi-Tenant | `Tenant` model is in the schema; `tenantId` already in every JWT |
| E — Billing | Add `Subscription` table to Prisma schema |
| F — RBAC v2 | `UserRole` enum is extensible in the schema |
| N — Automations | Add `Job` / `AutomationRun` tables; provisioning saga already exists |

The entire mock-to-production migration preserves every API route and JWT contract the frontend already depends on — zero frontend code changes required for the auth flow.

