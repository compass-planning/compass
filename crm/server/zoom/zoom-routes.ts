import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { isAuthenticated } from "../auth";
import { storage } from "../storage";
import { pool } from "../db";
import { logEmailAudit } from "../email/audit";
import {
  isZoomConfigured, createPkcePair, getZoomAuthUrl, exchangeZoomCode, fetchZoomUser,
  saveZoomConnection, disconnectZoom, getValidZoomAccessToken, ZoomAuthError,
} from "./zoom-client";

type Sess = { staffId?: number; userType?: string; zoomOAuth?: { state: string; verifier: string; staffId: number; at: number } };

async function currentStaff(req: Request) {
  const s = req.session as unknown as Sess;
  if (s.userType === "host" || !s.staffId) return null;
  return (await storage.getStaffMember(s.staffId)) || null;
}

function audit(req: Request, staff: { id: number; companyId: number | null }, action: "zoom.connect" | "zoom.disconnect", detail?: Record<string, unknown>) {
  void logEmailAudit({ companyId: staff.companyId ?? null, actorType: "staff", actorId: staff.id, action, provider: "zoom", targetId: null, detail, ip: req.ip || null });
}

export function registerZoomRoutes(app: Express) {
  // Begin OAuth. State + PKCE verifier live server-side in the session and are bound to this advisor.
  app.get("/api/zoom/connect", isAuthenticated, async (req: Request, res: Response) => {
    const staff = await currentStaff(req);
    if (!staff) return res.status(403).json({ message: "Advisor account required" });
    if (!isZoomConfigured()) return res.status(500).json({ message: "Zoom is not configured. ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET are required." });
    const state = crypto.randomBytes(32).toString("hex");
    const { verifier, challenge } = createPkcePair();
    (req.session as unknown as Sess).zoomOAuth = { state, verifier, staffId: staff.id, at: Date.now() };
    res.redirect(getZoomAuthUrl(state, challenge));
  });

  app.get("/api/zoom/callback", isAuthenticated, async (req: Request, res: Response) => {
    const back = (q: string) => res.redirect(`/crm/settings?${q}`);
    try {
      const staff = await currentStaff(req);
      if (!staff) return back("zoom=error&reason=not_authenticated");
      const sess = req.session as unknown as Sess;
      const saved = sess.zoomOAuth;
      delete sess.zoomOAuth; // single use
      if (req.query.error) return back("zoom=error&reason=denied");
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      if (!code) return back("zoom=error&reason=no_code");
      // State must match, belong to this advisor, and be fresh (10 min).
      if (!saved || !state || state.length !== saved.state.length
          || !crypto.timingSafeEqual(Buffer.from(state), Buffer.from(saved.state))
          || saved.staffId !== staff.id || Date.now() - saved.at > 10 * 60 * 1000) {
        return back("zoom=error&reason=invalid_state");
      }
      const tokens = await exchangeZoomCode(code, saved.verifier);
      const zu = await fetchZoomUser(tokens.access_token);
      await saveZoomConnection({ companyId: staff.companyId ?? null, staffId: staff.id, zoomUser: zu, tokens });
      audit(req, staff, "zoom.connect", { zoomUserId: zu.id, scopes: (tokens.scope ?? "").split(/\s+/).filter(Boolean) });
      back("zoom=connected");
    } catch (e) {
      console.error("[zoom] callback failed:", e instanceof Error ? e.message : e);
      back(`zoom=error&reason=${e instanceof ZoomAuthError && /already connected/.test(e.message) ? "already_connected" : "failed"}`);
    }
  });

  app.get("/api/zoom/status", isAuthenticated, async (req: Request, res: Response) => {
    const staff = await currentStaff(req);
    if (!staff) return res.status(403).json({ message: "Advisor account required" });
    const r = await pool.query(
      "SELECT zoom_email, status, granted_scopes, connected_at FROM zoom_accounts WHERE staff_id = $1", [staff.id]);
    const a = r.rows[0];
    res.json({
      configured: isZoomConfigured(),
      connected: a?.status === "connected",
      needsReauth: a?.status === "needs_reauth",
      email: a?.status === "connected" || a?.status === "needs_reauth" ? a.zoom_email : null,
      scopes: a?.status === "connected" ? a.granted_scopes : [],
      connectedAt: a?.connected_at ?? null,
    });
  });

  // Health check: forces a refresh if due and confirms Zoom still accepts the connection.
  app.post("/api/zoom/refresh", isAuthenticated, async (req: Request, res: Response) => {
    const staff = await currentStaff(req);
    if (!staff) return res.status(403).json({ message: "Advisor account required" });
    try {
      await getValidZoomAccessToken(staff.id);
      res.json({ ok: true });
    } catch (e) {
      res.status(409).json({ ok: false, message: e instanceof Error ? e.message : "Zoom unavailable" });
    }
  });

  app.post("/api/zoom/disconnect", isAuthenticated, async (req: Request, res: Response) => {
    const staff = await currentStaff(req);
    if (!staff) return res.status(403).json({ message: "Advisor account required" });
    const had = await disconnectZoom(staff.id);
    if (had) audit(req, staff, "zoom.disconnect");
    res.json({ ok: true });
  });
}
