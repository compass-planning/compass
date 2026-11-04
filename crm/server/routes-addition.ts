// ─────────────────────────────────────────────────────────────────────────────
// Add to Compass CRM server/routes.ts
// ─────────────────────────────────────────────────────────────────────────────

// 1. Add this import near the top with other route imports:
import { fpFullRouter } from "./planning/fp-full-be.js";

// 2. Add this mount inside registerRoutes() with the other app.use() calls:
//    Mount BEFORE the existing FP routes so it takes priority:
app.use("/api", isAuthenticated, denyHostUsers, fpFullRouter);

// That's it. The fpFullRouter handles:
//   GET/POST   /api/clients/:clientId/plans
//   GET/PUT/DELETE /api/plans/:id
//   POST       /api/clients/:clientId/insurance-worksheet
//   GET/POST   /api/clients/:clientId/tax-planning-notes
//   PUT/DELETE /api/tax-planning-notes/:id
//   GET/POST   /api/clients/:clientId/estate-planning-notes
//   PUT/DELETE /api/estate-planning-notes/:id
//   GET        /api/clients/:clientId/financial-planning-overview
//   GET/POST   /api/plans/:planId/assumptions
//   GET        /api/plans/:planId/simulation-results
//   POST       /api/plans/:planId/run-simulation
//   GET        /api/plans/:planId/stale-flags
//   GET/POST   /api/plans/:planId/snapshots
//   GET/POST   /api/plans/:planId/action-items
//   PUT/DELETE /api/action-items/:id
//   GET        /api/clients/:clientId/saved-plans
//   DELETE     /api/saved-plans/:id
