import express from "express";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Router = require("router");
const prefixes = new WeakMap<object, string>();
const origUse = Router.prototype.use;
Router.prototype.use = function (...args: any[]) {
  let path = "";
  let rest = args;
  if (typeof args[0] === "string") { path = args[0]; rest = args.slice(1); }
  for (const f of rest.flat(Infinity)) if (f && typeof f === "function" && f.stack) prefixes.set(f, path);
  return origUse.apply(this, args);
};
const { registerRoutes } = await import("../server/routes");
const http = await import("http");
const app = express();
const server = http.createServer(app);
await registerRoutes(server as any, app as any).catch((e: any) => console.error("reg err", e?.message));
const out: string[] = [];
function walk(stack: any[], prefix: string) {
  for (const l of stack) {
    if (l.route) {
      for (const m of Object.keys(l.route.methods)) out.push(`${m.toUpperCase()} ${(prefix + l.route.path).replace(/\/+/g, "/")}`);
    } else if (l.handle?.stack) {
      walk(l.handle.stack, prefix + (prefixes.get(l.handle) || ""));
    }
  }
}
walk((app as any).router.stack, "");
console.log(out.join("\n"));
process.exit(0);
