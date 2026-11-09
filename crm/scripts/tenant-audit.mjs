#!/usr/bin/env node
/**
 * Cross-tenant isolation audit for Compass CRM.
 *
 * Creates two throwaway companies (A and B), seeds Company A's data into every table, then calls
 * EVERY route as Company B (and logged out) and checks that:
 *   1. no response contains Company A's data            (read leaks)
 *   2. no request changes Company A's rows               (cross-company writes/deletes)
 *   3. logged-out callers get nothing from protected routes
 *
 * RUN IT ONLY AGAINST A LOCAL / TEST DATABASE. It creates and deletes data and refuses to run unless
 * DATABASE_URL and the server URL are both localhost.
 *
 *   PowerShell (from the crm folder), with the server running against the test DB:
 *     $env:DATABASE_URL="postgres://user:pass@localhost:5432/crm_test"
 *     $env:AUDIT_BASE_URL="http://localhost:5000"        # where the CRM server listens
 *     $env:AUDIT_API_PREFIX="/api"                       # "/api/crm" if you run the combined Compass server
 *     node scripts/tenant-audit.mjs
 *
 * Exit code 0 = clean, 1 = findings, 2 = setup problem.
 */
import pg from "pg";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const BASE = (process.env.AUDIT_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
const PREFIX = process.env.AUDIT_API_PREFIX ?? "/api";
const DB_URL = process.env.DATABASE_URL;
const SCHEMA = process.env.AUDIT_DB_SCHEMA || "crm";
const PASSWORD = "Correct-Horse-Battery-9!";
const SENT = "TENANT_A_SECRET";
const MARKS = [SENT, "AlphaCorpXYZ", "alpha-owner", "AlphaFirst"];
// Shared reference data that every company is meant to see.
const SHARED_READS = new Set(["/api/carriers"]);
// Routes that are intentionally public or must not be exercised.
const PUBLIC_UNAUTH = new Set(["/api/bot/health"]);
const SKIP = /\/auth\/logout$|^\/api\/logout$|change-password|\/mfa\/|\/auth\/login|\/auth\/register|\/staff\/me\/password/;
const SKIP_TABLES = new Set(["session", "sessions", "email_audit_logs", "companies", "staff", "clients", "host_users", "host_staff"]);

const die = (m) => { console.error("\n" + m); process.exit(2); };
if (!DB_URL) die("Set DATABASE_URL to your LOCAL test database first (see header of this file).");
const isLocal = (u) => /@?(localhost|127\.0\.0\.1|\[::1\])([:/]|$)/.test(u);
if (!isLocal(DB_URL) || !isLocal(BASE)) die("Refusing to run: DATABASE_URL and AUDIT_BASE_URL must both point at localhost. This script writes and deletes data.");

const here = path.dirname(fileURLToPath(import.meta.url));
const db = new pg.Client({ connectionString: DB_URL });
await db.connect();
await db.query(`set search_path=${SCHEMA}`);
const q = async (text, params) => (await db.query(text, params)).rows;
const one = async (text, params) => Object.values((await q(text, params))[0] ?? {})[0];

// ---------- route table (spawns tsx to read the real Express router)
function loadRoutes() {
  const file = process.env.AUDIT_ROUTES_FILE;
  if (file && existsSync(file)) return readFileSync(file, "utf8");
  const r = spawnSync("npx", ["tsx", path.join(here, "dump-routes.ts")], { cwd: path.join(here, ".."), encoding: "utf8", shell: true, env: process.env, maxBuffer: 1 << 26 });
  if (r.status !== 0) die("Could not list routes:\n" + (r.stderr || "").slice(-600));
  return r.stdout;
}
const routes = loadRoutes().split(/\r?\n/).map((l) => l.trim()).filter((l) => /^(GET|POST|PUT|PATCH|DELETE) \//.test(l)).map((l) => l.split(" "));
if (routes.length < 50) die(`Only ${routes.length} routes found - route dump looks wrong.`);

// ---------- HTTP client with its own cookie jar (Node fetch has none)
class Client {
  constructor() { this.cookie = ""; }
  async req(method, p, body, timeoutMs = 12000) {
    const ip = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${1 + Math.floor(Math.random() * 253)}`;
    try {
      const res = await fetch(BASE + PREFIX + p.replace(/^\/api/, ""), {
        method,
        headers: { "Content-Type": "application/json", "x-forwarded-proto": "https", "X-Forwarded-For": ip, ...(this.cookie ? { Cookie: this.cookie } : {}) },
        body: body && method !== "GET" ? JSON.stringify(body) : undefined,
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      });
      const sc = res.headers.get("set-cookie");
      const m = sc && sc.match(/connect\.sid=[^;]+/);
      if (m) this.cookie = m[0];
      return { status: res.status, text: await res.text() };
    } catch (e) { return { status: -1, text: String(e.message).slice(0, 80) }; }
  }
}
const pool = async (items, n, fn) => { const out = []; let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; };

// ---------- two companies
const ts = Date.now();
const A = new Client(), B = new Client(), N = new Client();
for (const [c, co, fn, em] of [[A, "AlphaCorpXYZ", "AlphaFirst", `alpha-owner${ts}@audit.test`], [B, "BetaCorp", "BetaFirst", `beta-owner${ts}@audit.test`]]) {
  const r = await c.req("POST", "/api/auth/register", { companyName: co, firstName: fn, lastName: "Owner", email: em, password: PASSWORD });
  if (![200, 201].includes(r.status)) die(`Registering ${co} failed (${r.status}): ${r.text.slice(0, 200)}\nIs the server running against this DATABASE_URL, and is AUDIT_API_PREFIX right?`);
}
const mkClient = async (c, first, email) => JSON.parse((await c.req("POST", "/api/clients", { firstName: first, lastName: "Roy", email, dateOfBirth: "1980-03-02", province: "ON", status: "client" })).text).id;
const cA = await mkClient(A, SENT, `ca${ts}@audit.test`), cB = await mkClient(B, "BetaClient", `cb${ts}@audit.test`);
const coA = Number(await one("select company_id from clients where id=$1", [cA])), coB = Number(await one("select company_id from clients where id=$1", [cB]));
if (!coA || coA === coB) die("Could not create two separate companies.");
console.log(`Company A=${coA} (client ${cA})  Company B=${coB} (client ${cB})  routes=${routes.length}`);

// ---------- seed A across every table
const colRows = await q(`select table_name t,column_name c,data_type d,is_nullable n,coalesce(column_default,'') df from information_schema.columns where table_schema=$1 order by table_name,ordinal_position`, [SCHEMA]);
const cols = {};
for (const r of colRows) (cols[r.t] ??= []).push({ c: r.c, d: r.d, nn: r.n === "NO", df: r.df });
const lit = (d) => d === "text" || d === "character varying" || d === "character" ? `'${SENT}'` : ["integer", "bigint", "smallint", "numeric", "double precision", "real"].includes(d) ? "1" : d === "boolean" ? "false" : d.includes("timestamp") ? "now()" : d === "date" ? "current_date" : d === "jsonb" || d === "json" ? `'{"s":"${SENT}"}'` : d === "ARRAY" ? "'{}'" : "NULL";
const staffA = async () => String(await one("select id from staff where company_id=$1 order by id limit 1", [coA]));
async function parentOf(c, ids) {
  const base = c.slice(0, -3);
  if (["staff", "admin", "advisor", "user", "created_by", "assigned_to", "owner", "host_staff"].includes(base)) return await staffA();
  for (const cand of [base + "s", base + "es", base.endsWith("y") ? base.slice(0, -1) + "ies" : null, "service_" + base + "s"]) if (cand && cols[cand]) return ids[cand] || "DEFER";
  return null;
}
async function seedA() {
  const ids = {}; let pending = Object.keys(cols).filter((t) => !SKIP_TABLES.has(t));
  for (let round = 0; round < 6 && pending.length; round++) {
    const next = [];
    for (const t of pending) {
      const names = [], vals = []; let defer = false;
      const plan = await one("select id from financial_plans where client_id=$1 limit 1", [cA]);
      for (const { c, d, df } of cols[t]) {
        let v;
        if (c === "id" && df.startsWith("nextval")) continue;
        else if (c === "client_id") v = String(cA);
        else if (c === "company_id") v = String(coA);
        else if (c === "plan_id" && plan) v = String(plan);
        else if ((c === "created_at" || c === "updated_at") && df) continue;
        else if (c.endsWith("_id") && c !== "id") {
          const pv = await parentOf(c, ids);
          if (pv === "DEFER") { if (round < 5) { defer = true; break; } v = d === "integer" || d === "bigint" ? "1" : lit(d); }
          else v = pv ?? (d === "integer" || d === "bigint" ? "1" : lit(d));
        } else if (df) continue;
        else v = lit(d);
        names.push(`"${c}"`); vals.push(v);
      }
      if (defer) { next.push(t); continue; }
      try { const r = await q(`insert into "${t}" (${names.join(",")}) values (${vals.join(",")}) returning id`); ids[t] = r[0]?.id != null ? String(r[0].id) : null; }
      catch { next.push(t); }
    }
    pending = next;
  }
  return { ids, failed: pending };
}
const seeded = await seedA();
console.log(`Seeded Company A rows in ${Object.keys(seeded.ids).length} tables` + (seeded.failed.length ? ` (could not seed: ${seeded.failed.join(", ")})` : ""));

function predicate(t, depth = 0) {
  const names = new Set(cols[t].map((x) => x.c));
  if (t === "clients" || t === "staff") return `company_id=${coA}`;
  if (t === "companies") return `id=${coA}`;
  if (names.has("company_id")) return `company_id=${coA}`;
  if (names.has("client_id")) return `client_id in (select id from clients where company_id=${coA})`;
  if (depth < 3) for (const [par, col] of [["meetings", "meeting_id"], ["leads", "lead_id"], ["service_cases", "case_id"], ["service_cases", "service_case_id"], ["staff", "staff_id"], ["staff", "admin_id"], ["financial_goals", "goal_id"], ["financial_plans", "plan_id"]])
    if (names.has(col) && cols[par]) { const pp = predicate(par, depth + 1); if (pp) return `${col} in (select id from "${par}" where ${pp})`; }
  return null;
}
const PRED = {};
for (const t of Object.keys(cols)) if (!["session", "sessions"].includes(t)) { const p = predicate(t); if (p) PRED[t] = p; }
const snapshot = async () => (await q("select " + Object.entries(PRED).map(([t, p]) => `(select coalesce(md5(string_agg(x::text,'|' order by x::text)),'') from "${t}" x where ${p})`).join(" || ',' || ") + " as s"))[0].s;
const unscoped = Object.keys(cols).filter((t) => !PRED[t] && !["session", "sessions", "email_audit_logs"].includes(t)).sort();

const idset = new Set([Number(await staffA()), coA, cA]);
for (const [t, p] of Object.entries(PRED)) if (cols[t].some((x) => x.c === "id")) for (const r of await q(`select id from "${t}" where ${p}`)) idset.add(Number(r.id));
// Always test the staff / company / client IDs (they are the large ones), then fill up with other row IDs.
const keyIds = [Number(await staffA()), coA, cA];
const ids = [...new Set([...keyIds, ...[...idset].filter(Number.isFinite).sort((a, b) => a - b)])].slice(0, 20);
const fill = (p, i) => p.replace(/:\w+/g, String(i));
const attackBody = () => ({ ...Object.fromEntries(["firstName", "lastName", "name", "title", "notes", "description", "email", "status", "content", "subject", "message", "text", "value", "label", "phone", "address", "city", "type"].map((k) => [k, "HACKED_BY_B"])), amount: 999, age: 50 });
const usable = routes.filter(([, p]) => !SKIP.test(p));

// ---------- 1. logged-out
const unauth = (await pool(usable, 8, async ([m, p]) => { const r = await N.req(m, fill(p, ids[0] ?? 1), m === "GET" ? undefined : attackBody(), 8000); return [200, 201, 204].includes(r.status) || (r.status >= 500 && r.status !== 503) ? { m, p, status: r.status } : null; })).filter((x) => x && !PUBLIC_UNAUTH.has(x.p));

// ---------- positive control: A must be able to read its own data
const reads = usable.filter(([m]) => m === "GET").flatMap(([m, p]) => (p.includes(":") ? ids : [0]).map((i) => [m, p, i]));
const ctl = await pool(reads, 8, async ([m, p, i]) => { const r = await A.req(m, fill(p, i)); return { ok: r.status >= 200 && r.status < 300, has: MARKS.some((k) => r.text.includes(k)) }; });
const ctlHits = ctl.filter((x) => x.has).length;
console.log(`Control: Company A read its own data on ${ctlHits} responses (needs > 0 for the test to mean anything)`);
if (ctlHits === 0) die("Control failed: Company A could not read its own seeded data, so a clean result would be meaningless.");

// ---------- 2. B reads A
let base = await snapshot();
const readOut = (await pool(reads, 8, async ([m, p, i]) => { const r = await B.req(m, fill(p, i)); if (r.status >= 200 && r.status < 300 && MARKS.some((k) => r.text.includes(k))) return { m, p, i }; return null; })).filter((x) => x && !SHARED_READS.has(x.p));
const readsChangedData = (await snapshot()) !== base;

// ---------- 3. B writes to A
const writes = [];
const sessionOk = async () => { if ((await B.req("GET", "/api/auth/user")).status !== 200) await B.req("POST", "/api/auth/login", { email: `beta-owner${ts}@audit.test`, password: PASSWORD }); };
for (const [m, p] of usable.filter(([m]) => m !== "GET")) {
  for (const i of p.includes(":") ? ids : [0]) {
    await sessionOk();
    const r = await B.req(m, fill(p, i), attackBody(), 15000);
    const now = await snapshot();
    if (now !== base) {
      writes.push({ m, p, i, status: r.status });
      for (const t of Object.keys(PRED)) if (!["clients", "staff", "companies"].includes(t)) await q(`delete from "${t}" where ${PRED[t]}`).catch(() => {});
      await seedA(); base = await snapshot();
    }
  }
}

// ---------- report
const uniq = (a, f) => [...new Map(a.map((x) => [f(x), x])).values()];
console.log("\n==================== TENANT ISOLATION AUDIT ====================");
console.log(`Tables with no company/client/plan link (check by hand): ${unscoped.join(", ") || "none"}`);
console.log(`\nLogged-out access that returned data or crashed: ${unauth.length}`); unauth.forEach((x) => console.log(`  ${x.m} ${x.p} -> ${x.status}`));
console.log(`\nCompany B could READ Company A data: ${readOut.length}`); uniq(readOut, (x) => x.m + x.p).forEach((x) => console.log(`  ${x.m} ${x.p} (id ${x.i})`));
if (readsChangedData) console.log("\nWARNING: a GET request changed Company A's data.");
console.log(`\nCompany B could CHANGE/DELETE Company A data: ${writes.length}`); uniq(writes, (x) => x.m + x.p).forEach((x) => console.log(`  ${x.m} ${x.p} (id ${x.i}) -> ${x.status}`));
const bad = unauth.length + readOut.length + writes.length + (readsChangedData ? 1 : 0);
console.log(bad ? `\nRESULT: ${bad} FINDING(S) - fix before deploying.` : "\nRESULT: CLEAN - no cross-company access found.");
await db.end();
process.exit(bad ? 1 : 0);
