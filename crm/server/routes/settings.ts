/**
 * server/routes/settings.ts
 *
 * User settings endpoints.
 *
 * Mount in server/routes.ts:
 *   import settingsRouter from "./routes/settings";
 *   app.use("/api/settings", isAuthenticated, settingsRouter);
 */

import { Router, type Response } from "express";
import { db } from "../db";
import { staff } from "@shared/schema";
import { eq } from "drizzle-orm";
import { isAuthenticated } from "../auth";
import { logger } from "../logger";

const router = Router();
router.use(isAuthenticated);

// PATCH /api/settings/language
router.patch("/language", async (req: any, res: Response) => {
  try {
    const { preferredLanguage } = req.body as { preferredLanguage?: string };
    if (!preferredLanguage || !["en", "fr"].includes(preferredLanguage)) {
      return res.status(400).json({ message: "Invalid language code. Must be 'en' or 'fr'." });
    }
    await db
      .update(staff)
      .set({ preferredLanguage } as any)
      .where(eq(staff.id, req.user.id));
    logger.info({ staffId: req.user.id, preferredLanguage }, "Language preference updated");
    return res.json({ preferredLanguage });
  } catch (err) {
    logger.error({ err }, "Failed to update language preference");
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/settings
router.get("/", async (req: any, res: Response) => {
  try {
    const [member] = await db
      .select({ preferredLanguage: (staff as any).preferredLanguage })
      .from(staff)
      .where(eq(staff.id, req.user.id))
      .limit(1);
    return res.json({ preferredLanguage: member?.preferredLanguage ?? "en" });
  } catch (err) {
    logger.error({ err }, "Failed to fetch settings");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
