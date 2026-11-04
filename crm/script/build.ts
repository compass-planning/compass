import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";

// Server deps bundled into dist/server.cjs (fewer files to open at cold start).
// Everything else stays external and is resolved from crm/node_modules at runtime.
// "express" MUST be bundled: the CRM uses Express 5, the Compass host uses Express 4.
const allowlist = [
  "@google/generative-ai", "axios", "connect-pg-simple", "cors", "date-fns", "drizzle-orm",
  "drizzle-zod", "express", "express-rate-limit", "express-session", "jsonwebtoken",
  "memorystore", "multer", "nanoid", "nodemailer", "openai", "passport", "passport-local",
  "pg", "stripe", "uuid", "ws", "xlsx", "zod", "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building crm client...");
  await viteBuild();

  console.log("building crm server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/app.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/server.cjs",
    define: { "process.env.NODE_ENV": '"production"' },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => { console.error(err); process.exit(1); });
