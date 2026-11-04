# Compass CRM

The advisor CRM of the Compass family It lives inside the Compass repo but is a
separate project with its own `package.json` (it needs Express 5; Compass runs Express 4) and ships in the
**same Docker image / Fly app** as Compass Planning.

| | |
|---|---|
| Web client | `/crm/*` (login `/crm/login`, create account `/crm/register`) |
| API | `/api/crm/*` (session-cookie auth; independent of Compass Planning's JWT login) |
| Database | same Postgres, own schema `crm` (created on first start; tables never touch `public`) |
| Entry page | the shared Compass landing page at `/` has the Compass CRM card |

## How it is wired
- `npm run build` (repo root) builds Compass, then `crm/` → `crm/dist/public` (client, base `/crm/`) and `crm/dist/server.cjs`.
- `server/index.ts` (Compass) loads `crm/dist/server.cjs` after it starts listening and mounts it at `/api/crm` and `/crm`.
  If the bundle is missing or fails to start, Compass Planning keeps running and `/crm` returns 503.
- `crm/server/app.ts` exposes `createCrmApp`, `crmApiHandler` (re-adds the `/api` prefix the CRM's routes expect) and `crmStaticHandler`.
- `crm/server/initSchema.ts` creates schema `crm` + all tables from `baselineSql.ts` on first start.
  Later additive column changes: `npm --prefix crm run db:reconcile` (adds missing columns from `shared/schema.ts`).
  `baselineSql.ts` is generated: `DATABASE_URL=… npx drizzle-kit export --sql` (strip the `"public".` qualifiers).

## Develop
```
npm run install:crm        # once
npm run build:crm          # server bundle + client
npm run dev:server         # Compass server on :8080 (loads the CRM bundle)
npm --prefix crm run dev   # CRM client with HMR on :5174 (proxies /api/crm to :8080)
```
