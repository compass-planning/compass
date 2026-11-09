import express, { type Request, Response, NextFunction } from "express";
import { logger, createRequestLogger } from "./logger";
import { randomUUID } from "crypto";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { startWorkflowAutomation } from "./services/workflowAutomation";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { ensureCrmSchema } from "./initSchema";

const app        = express();

declare module "http" {
  interface IncomingMessage { rawBody: unknown; }
}

// ── Security middleware ────────────────────────────────────────────────────────
// Helmet: sets secure HTTP response headers (CSP, HSTS, X-Frame-Options, etc.)
const isProd = process.env.NODE_ENV === "production";
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      // In production: no unsafe-inline — Vite bundles into static chunks that don't need it.
      // In dev: Vite HMR injects inline scripts so we allow it. Never ship unsafe-inline to prod.
      scriptSrc:   isProd
        ? ["'self'", "https://static.cloudflareinsights.com"]
        : ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc:     ["'self'", "data:", "https://fonts.gstatic.com"],
      imgSrc:      ["'self'", "data:", "blob:"],
      connectSrc:  ["'self'", "https://cloudflareinsights.com"],
      objectSrc:   ["'none'"],
      frameAncestors: ["'none'"],   // clickjacking protection
      upgradeInsecureRequests: isProd ? [] : undefined,
    },
  },
  hsts: {
    maxAge:            31536000,
    includeSubDomains: true,
    preload:           true,
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

// CORS: allow only the production domain and local dev.
// Credentials: true is required for cookie-based sessions.
const allowedOrigins =
  process.env.NODE_ENV === "production"
    ? [
        "https://compass-feaspq.fly.dev",
        "https://compassplanning.app",
        "https://www.compassplanning.app",
        ...(process.env.CUSTOM_DOMAIN ? [`https://${process.env.CUSTOM_DOMAIN}`] : []),
      ]
    : ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"];

app.use(cors((req, callback) => {
  const origin = req.headers.origin;
  // Same-origin requests (the CRM is served from the same host as its API) are always fine;
  // otherwise only the configured origins. No Origin header = non-browser client.
  let sameOrigin = false;
  try { sameOrigin = !!origin && new URL(origin).host === req.headers.host; } catch { /* malformed Origin */ }
  const ok = !origin || sameOrigin || allowedOrigins.includes(origin);
  if (!ok) return callback(new Error(`CORS: origin '${origin}' not allowed`));
  callback(null, {
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
}));

// Rate limiting — applied per IP address.
// Login: 10 attempts per 15 min — brute-force protection.
const loginLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  skipSuccessfulRequests: false,
  message:          { message: "Too many login attempts. Please try again in 15 minutes." },
  keyGenerator:     (req) => req.ip ?? "unknown",
});
app.use("/api/auth/login", loginLimiter);

// MFA verification — tight limit to stop TOTP/recovery-code brute force.
const mfaLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { message: "Too many verification attempts. Please wait 15 minutes." },
  keyGenerator:    (req) => req.ip ?? "unknown",
});
app.use("/api/auth/mfa/verify",  mfaLimiter);
app.use("/api/auth/mfa/recover", mfaLimiter);

// Monte Carlo & AI report routes: expensive compute + Anthropic API cost.
const computeLimiter = rateLimit({
  windowMs:  60 * 1000,
  max:       10,
  standardHeaders: true,
  legacyHeaders:   false,
  message:   { message: "Too many simulation requests. Please wait a moment." },
});
app.use("/api/clients/:id/simulate",   computeLimiter);
app.use("/api/clients/:id/ai-report",  computeLimiter);

// General API: 300 req/min per IP — generous for normal use, blocks scrapers.
const apiLimiter = rateLimit({
  windowMs:  60 * 1000,
  max:       300,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:      (req) => req.path === "/health",   // health check always exempt
  message:   { message: "Too many requests. Please slow down." },
});
app.use("/api/", apiLimiter);

// Add Cache-Control: no-store to all API responses.
// Financial data must never be cached by proxies or browsers.
app.use("/api/", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  next();
});

// ── Body parsing ────────────────────────────────────────────────────────────────
// Global limit: 1mb — sufficient for all JSON API calls.
// Upload routes override this with their own express.json({ limit: "20mb" }).
// Routes that legitimately carry large JSON bodies are parsed with their own limit below;
// the global parser must skip them or it would reject them at 1mb first.
const LARGE_BODY_ROUTES: Array<[RegExp, string]> = [
  [/^\/api\/documents/, "20mb"],
  [/^\/api\/meetings\/recording/, "20mb"],
  [/^\/api\/clients\/[^/]+\/import/, "10mb"],
  [/^\/api\/email\/messages/, "35mb"], // base64 attachments (~25MB of files)
];
const globalJson = express.json({
  limit: "1mb",
  verify: (req, _res, buf) => { (req as any).rawBody = buf; },
});
app.use((req, res, next) => {
  if (LARGE_BODY_ROUTES.some(([re]) => re.test(req.path))) return next();
  return globalJson(req, res, next);
});
app.use(express.urlencoded({ extended: false }));

// Never send credential material to the browser: strip secret columns from every JSON response,
// whatever route returned them (e.g. a raw staff row from /api/staff/me).
const SECRET_KEYS = new Set(["passwordHash", "totpSecret", "codeHash", "encryptedCredentials"]);
function stripSecrets(v: any): any {
  if (Array.isArray(v)) return v.map(stripSecrets);
  if (v && typeof v === "object" && Object.getPrototypeOf(v) === Object.prototype) {
    const out: Record<string, any> = {};
    for (const [k, val] of Object.entries(v)) if (!SECRET_KEYS.has(k)) out[k] = stripSecrets(val);
    return out;
  }
  return v;
}
app.use((_req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body?: any) => json(stripSecrets(body));
  next();
});

// Override body limit for routes that legitimately need large payloads.
for (const [re, limit] of LARGE_BODY_ROUTES) {
  const parser = express.json({ limit });
  app.use((req, res, next) => (re.test(req.path) ? parser(req, res, next) : next()));
}

// Legacy log() shim — backed by pino. New code should import logger directly.
export function log(message: string, source = "express") {
  logger.info({ source }, message);
}

// Request middleware: attach a request-scoped child logger with a unique ID.
// Every log line within a request automatically includes requestId for tracing.
// PIPEDA: we log only method, path, status, duration — never bodies or PII.
app.use((req: any, res, next) => {
  const start     = Date.now();
  const requestId = randomUUID();
  req.requestId   = requestId;
  req.log         = logger.child({ requestId, method: req.method, path: req.path });

  res.on("finish", () => {
    if (req.path.startsWith("/api") || req.path === "/health") {
      const ms      = Date.now() - start;
      const level   = res.statusCode >= 500 ? "error"
                    : res.statusCode >= 400 ? "warn"
                    : "info";
      (req.log as any)[level]({ status: res.statusCode, ms }, `${req.method} ${req.path}`);
    }
  });
  next();
});

/**
 * Build the Compass CRM Express app. The host (Compass server) mounts it at /api/crm
 * via crmApiHandler and serves the client bundle via crmStaticHandler at /crm.
 */
export async function createCrmApp() {
  await ensureCrmSchema();
  const httpServer = createServer(app); // routes.ts expects a Server; the host owns the real listener
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status  = err.status || err.statusCode || 500;
    const message = isProd ? "Internal Server Error" : (err.message || "Internal Server Error");
    logger.error({ err, status }, "Unhandled error");
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  startWorkflowAutomation();
  return app;
}

/**
 * Express 4 (Compass) mounts this at /api/crm and strips that prefix. The CRM's routes are
 * written against /api/*, so put "/api" back on url + originalUrl for the CRM, then restore.
 */
export function crmApiHandler(crm: express.Express) {
  return (req: any, res: Response, next: NextFunction) => {
    const { url, originalUrl } = req;
    req.url = "/api" + (url === "/" ? "" : url);
    req.originalUrl = (originalUrl || "").replace(/^\/api\/crm/, "/api");
    crm(req, res, (err?: any) => {
      req.url = url;
      req.originalUrl = originalUrl;
      next(err);
    });
  };
}

/** Static client (built with base /crm/) + SPA fallback. Mount at /crm. */
export function crmStaticHandler() {
  const distPath = path.resolve(__dirname, "public");
  const router = express.Router();
  if (!fs.existsSync(distPath)) {
    logger.warn({ distPath }, "[crm] client build not found — /crm will 404 until `npm run build:crm`");
    return router;
  }
  router.use(express.static(distPath, { index: false, maxAge: "1h" }));
  router.get(/.*/, (req, res) => {
    if (req.path.includes(".")) return res.status(404).send("Not found");
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.resolve(distPath, "index.html"));
  });
  return router;
}
