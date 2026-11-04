// ── ADD THESE LINES to server/routes.ts ──────────────────────────────────────
//
// 1. Imports (add near the other route imports):

import { usTaxRouter }  from "./routes/us-tax";
import { diLtcRouter }  from "./routes/di-ltc";

// 2. Route registration (add inside registerRoutes(), alongside other routers):

app.use("/api/us-tax",   usTaxRouter);
app.use("/api",          diLtcRouter);   // mounts at /api/clients/:id/ltc-analyses etc.
