import "dotenv/config";
import express from "express";

process.on("unhandledRejection", (reason) => { console.error("[unhandledRejection]", reason); });
process.on("uncaughtException",  (err)    => { console.error("[uncaughtException]", err); });

import cors            from "cors";
import helmet          from "helmet";
import rateLimit       from "express-rate-limit";
import path            from "path";
import { fileURLToPath } from "url";
import { pool, poolCA, poolUS, jurisdictionStore } from "./db/index.js";
import { authRouter }       from "./routes/auth.js";
import { subscriptionsRouter } from "./routes/subscriptions.js";
import { adminRouter }         from "./routes/admin.js";
import { clientsRouter }    from "./routes/clients.js";
import { financialRouter }  from "./routes/financial.js";
import { simulateRouter }   from "./routes/simulate.js";
import { simulationRouter } from "./routes/simulation.js";
import { reportsRouter }    from "./routes/reports.js";
import { taxRouter }        from "./routes/tax.js";
import { usTaxRouter }      from "./routes/us-tax.js";
import { lettersRouter }    from "./routes/letters.js";
import { goalsRouter }      from "./routes/goals.js";
import { pensionRouter }    from "./routes/pension.js";
import aiVoiceRouter        from "./routes/ai-voice.js";
import { mfaRouter }        from "./routes/mfa.js";
import { auditRouter }      from "./routes/audit.js";
import { httpLogger, logger } from "./logger.js";
import { planningRouter }   from "./planning/routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT      = parseInt(process.env.PORT ?? "8080", 10);

// ── Startup migrations (idempotent) ───────────────────────────────────────────
async function runMigrations() {
  const migrations = [
    `ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS tfsa_contributions_made decimal(15,2)`,
    `ALTER TABLE retirement_projections ADD COLUMN IF NOT EXISTS person TEXT DEFAULT 'primary'`,
    `ALTER TABLE ai_recommendations ADD COLUMN IF NOT EXISTS run_id TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS spouse_pension_type TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS jurisdiction TEXT NOT NULL DEFAULT 'CA'`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS us_state TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS filing_status TEXT`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS birth_year INTEGER`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en'`,
    // ── Subscription columns ────────────────────────────────────────────────
    `ALTER TABLE users DROP COLUMN IF EXISTS role`,
    `ALTER TABLE users DROP COLUMN IF EXISTS level`,
    `ALTER TABLE users DROP COLUMN IF EXISTS ga_id`,
    `ALTER TABLE users DROP COLUMN IF EXISTS agent_id`,
    `ALTER TABLE users DROP COLUMN IF EXISTS agency`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'trial'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trialing'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ`,
    // ── Admin tables ────────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS admin_users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'support',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS support_tickets (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
      user_email   TEXT,
      subject      TEXT NOT NULL,
      body         TEXT NOT NULL,
      status       TEXT NOT NULL DEFAULT 'open',
      priority     TEXT NOT NULL DEFAULT 'normal',
      assigned_to  INTEGER REFERENCES admin_users(id) ON DELETE SET NULL,
      resolved_at  TIMESTAMPTZ,
      notes        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON support_tickets(user_id)`,
    `CREATE INDEX IF NOT EXISTS support_tickets_status_idx  ON support_tickets(status)`,
    // ── Missing tables ──────────────────────────────────────────────────────────
    `CREATE TABLE IF NOT EXISTS ltc_analyses (
      id         SERIAL PRIMARY KEY,
      client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      plan_id    INTEGER REFERENCES financial_plans(id) ON DELETE CASCADE,
      data       JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS di_analyses (
      id         SERIAL PRIMARY KEY,
      client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      plan_id    INTEGER REFERENCES financial_plans(id) ON DELETE CASCADE,
      data       JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS saved_reports (
      id           SERIAL PRIMARY KEY,
      client_id    INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      plan_id      INTEGER REFERENCES financial_plans(id) ON DELETE CASCADE,
      advisor_id   INTEGER,
      title        TEXT NOT NULL,
      locale       TEXT NOT NULL DEFAULT 'en',
      sections     JSONB NOT NULL DEFAULT '[]',
      html_content TEXT,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS html_content TEXT`,
    `ALTER TABLE saved_reports ADD COLUMN IF NOT EXISTS advisor_id INTEGER`,
    `ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS province TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN NOT NULL DEFAULT false`,
    `CREATE TABLE IF NOT EXISTS audit_log (
      id                 SERIAL PRIMARY KEY,
      user_id            INTEGER,
      user_email         TEXT,
      action             TEXT NOT NULL,
      resource_type      TEXT,
      resource_id        INTEGER,
      client_id          INTEGER,
      external_processor TEXT,
      data_categories    TEXT,
      purpose_code       TEXT,
      record_count       INTEGER,
      ip_address         TEXT,
      user_agent         TEXT,
      correlation_id     TEXT,
      outcome            TEXT NOT NULL DEFAULT 'success',
      error_message      TEXT,
      created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS audit_log_client_id_idx ON audit_log(client_id)`,
    `CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action)`,
    `CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at)`,
    `CREATE INDEX IF NOT EXISTS audit_log_external_processor_idx ON audit_log(external_processor)`,
    `CREATE TABLE IF NOT EXISTS saved_reports (
      id            SERIAL PRIMARY KEY,
      client_id     INTEGER NOT NULL,
      title         TEXT NOT NULL,
      locale        TEXT NOT NULL DEFAULT 'en',
      sections      TEXT NOT NULL DEFAULT 'all',
      html_content  TEXT NOT NULL,
      generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      advisor_id    INTEGER
    )`,
    `CREATE INDEX IF NOT EXISTS saved_reports_client_idx ON saved_reports(client_id)`,
  ];
  for (const sql of migrations) {
    for (const p of [poolCA, ...(process.env.DATABASE_URL_US ? [poolUS] : [])]) {
      try { await p.query(sql); }
      catch (e: any) { console.error("[migration]", e.message); }  // ← Item 1: no sql in log (may contain PII via params)
    }
  }
  console.log("[migrations] done");
}

const app = express();

// ── Item 2a: Helmet — security headers ────────────────────────────────────────
app.set("trust proxy", 1); // Required for rate limiting behind Fly.io proxy

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://www.gstatic.com", "https://recaptcha.net"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc:      ["'self'", "data:", "blob:"],
      connectSrc:  ["'self'", "blob:", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://www.googleapis.com", "https://firebaseinstallations.googleapis.com"],
      frameSrc:    ["'self'", "https://compass-planning.firebaseapp.com", "https://recaptcha.net", "https://www.google.com"],
      fontSrc:     ["'self'", "data:", "https://fonts.gstatic.com"],
      objectSrc:   ["'none'"],
      frameSrc:    ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,   // needed for blob: report windows
}));

// ── Request logging (pino) ───────────────────────────────────────────────────────
app.use(httpLogger);

// ── Item 2b: CORS — locked to configured origin ────────────────────────────────
const allowedOrigins = [
  process.env.CLIENT_URL ?? "http://localhost:5173",
  process.env.CUSTOM_DOMAIN,
  // Always allow the canonical domains
  "https://compassplanning.app",
  "https://www.compassplanning.app",
  "https://compass-feaspq.fly.dev",
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Item 4: Body limit — 1 MB (was 10 MB) ─────────────────────────────────────
// Audio uploads use multipart/form-data via multer and are unaffected.
// ── Stripe webhook — must receive raw body before express.json parses it ─────
app.use("/api/subscription/webhook", express.raw({ type: "application/json" }));

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ── Item 2c: Rate limiting ─────────────────────────────────────────────────────
// Global limiter — generous ceiling, stops runaway clients
const globalLimiter = rateLimit({
  windowMs:          15 * 60 * 1000,  // 15 minutes
  max:               500,
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { message: "Too many requests, please try again later." },
});

// Auth limiter — tight, stops brute force on login/register/forgot
const authLimiter = rateLimit({
  windowMs:          15 * 60 * 1000,  // 15 minutes
  max:               20,              // 20 attempts per IP per 15 min
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { message: "Too many authentication attempts. Please wait 15 minutes." },
  skipSuccessfulRequests: true,       // only count failures
});

// AI limiter — Whisper + Claude calls are expensive
const aiLimiter = rateLimit({
  windowMs:          60 * 1000,       // 1 minute
  max:               10,
  standardHeaders:   true,
  legacyHeaders:     false,
  message:           { message: "AI rate limit reached. Please wait a moment." },
});

app.use(globalLimiter);
app.use("/api/auth", authLimiter);
app.use("/api/ai",   aiLimiter);

// ── Jurisdiction context middleware ────────────────────────────────────────────
app.use((req: any, _res: any, next: any) => {
  let jur: "CA" | "US" = "CA";
  try {
    const h = req.headers.authorization;
    if (h?.startsWith("Bearer ")) {
      const raw = h.slice(7).split(".")[1];
      if (raw) {
        const payload = JSON.parse(Buffer.from(raw, "base64url").toString());
        if (payload.jur === "US") jur = "US";
      }
    }
  } catch { /* ignore — defaults to CA */ }
  jurisdictionStore.run(jur, next);
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.get("/api/health",    (_req, res) => res.json({ ok: true }));
app.use("/api/auth",      authRouter);
app.use("/api/audit",       auditRouter);
app.use("/api/subscription", subscriptionsRouter);
app.use("/api/admin",        adminRouter);
app.use("/api",           goalsRouter);
app.use("/api",           pensionRouter);
app.use("/api/tax",       taxRouter);
app.use("/api/us-tax",    usTaxRouter);
app.use("/api",           financialRouter);
app.use("/api/clients",   clientsRouter);
app.use("/api",           simulateRouter);
app.use("/api",           simulationRouter);
app.use("/api/reports",   reportsRouter);
app.use("/api",           lettersRouter);
app.use("/api/ai",        aiVoiceRouter);
app.use("/api/planning",  planningRouter);

// ── Static (production) ────────────────────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const dist = path.join(__dirname, "../client");
  app.use(express.static(dist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".js"))  res.setHeader("Content-Type", "application/javascript");
      if (filePath.endsWith(".css")) res.setHeader("Content-Type", "text/css");
    },
  }));
  // Admin portal — served from public/admin.html in the client build output
  app.get("/admin", (_req, res) => res.sendFile(path.join(dist, "admin.html")));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) { res.status(404).json({ message: "Not found" }); return; }
    if (req.path.includes("."))       { res.status(404).send("Not found"); return; }
    res.sendFile(path.join(dist, "index.html"));
  });
}

// ── Global JSON error handler ───────────────────────────────────────────────
// Ensures unhandled Express errors return JSON, not HTML error pages
app.use((err: any, req: any, res: any, next: any) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal server error";
  console.error("[global-error-handler]", err.stack ?? err.message);
  if (req.path.startsWith("/api/")) {
    return res.status(status).json({ message });
  }
  next(err);
});

runMigrations().then(() => {
  app.listen(PORT, "0.0.0.0", () => logger.info({ port: PORT }, "FP server started"));
});

export default app;
