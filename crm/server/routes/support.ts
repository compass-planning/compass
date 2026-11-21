/** POST /api/support/report — a signed-in CRM user reports a problem; it lands in the corporate Service queue (app = CRM). */
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db";
import { getStaffFromSession } from "./middleware";

export const supportRouter = Router();

supportRouter.post("/report", async (req: any, res) => {
  const p = z.object({
    subject: z.string().trim().min(3).max(200),
    body: z.string().trim().min(5).max(5000),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    page: z.string().max(300).optional(),
  }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ message: p.error.errors[0].message });
  const staff = await getStaffFromSession(req);
  if (!staff?.companyId) return res.status(401).json({ message: "Unauthorized" });
  const n = await pool.query(`SELECT coalesce(max(id),0)+1 AS n FROM service_cases`);
  const caseNumber = `SVC-${String(n.rows[0].n).padStart(5, "0")}`;
  const ctx = [`Reported by: ${staff.firstName} ${staff.lastName} <${staff.email}>`, p.data.page ? `Page: ${p.data.page}` : "", `Browser: ${String(req.headers["user-agent"] || "").slice(0, 200)}`].filter(Boolean).join("\n");
  const r = await pool.query(
    `INSERT INTO service_cases (case_number, company_id, title, description, status, priority) VALUES ($1,$2,$3,$4,'open',$5) RETURNING id, case_number`,
    [caseNumber, staff.companyId, p.data.subject, `${p.data.body}\n\n---\n${ctx}`, p.data.priority ?? "medium"]);
  res.status(201).json({ ok: true, ...r.rows[0] });
});
