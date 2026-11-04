import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { eq, inArray } from "drizzle-orm";
import { api } from "@shared/routes";
import { children, documents, activities, insertClientSchema, advisorAssignments } from "@shared/schema";
import { isAuthenticated } from "../auth";
import {
  getStaffFromSession, getCompanyId, denyHostUsers,
  verifyClientOwnership, verifyFpRecordOwnership,
} from "./middleware";

export const clientsRouter = Router();

// ── Clients ───────────────────────────────────────────────────────────────────

clientsRouter.get("/api/clients", isAuthenticated, async (req: any, res) => {
  const currentStaff = await getStaffFromSession(req);
  const companyId = currentStaff?.companyId ?? undefined;

  // No staff session (host user) — return all company clients
  if (!currentStaff) {
    return res.json(await storage.getClients(companyId));
  }

  const { role, id } = currentStaff;

  // General Manager & Office Admin — full company visibility
  if (role === "general_manager" || role === "office_admin") {
    return res.json(await storage.getClients(companyId));
  }

  // Sales Manager — own clients + all directly assigned advisors' clients
  if (role === "sales_manager") {
    const assignedAdvisors = await storage.getAdvisorsByAdmin(id);
    const visibleIds = [id, ...assignedAdvisors.map((a: any) => a.id)];
    return res.json(await storage.getClientsByAdvisors(visibleIds));
  }

  // Advisor (Sales Rep) — only their own clients
  // Includes clients assigned to them by a manager (advisorId = their id)
  if (role === "advisor") {
    return res.json(await storage.getClientsByAdvisor(id));
  }

  // Advisor Admin (Sales Admin) — their own advisors' clients
  // PLUS the full purview of the Sales Manager(s) they report to
  if (role === "advisor_admin") {
    const myAdvisors = await storage.getAdvisorsByAdmin(id);
    const visibleIds = new Set<number>([id, ...myAdvisors.map((a: any) => a.id)]);

    // Find the Sales Manager(s) they report to via advisorAssignments
    const myManagerRows = await db
      .select()
      .from(advisorAssignments)
      .where(eq(advisorAssignments.advisorId, id));

    for (const row of myManagerRows) {
      visibleIds.add(row.adminId);
      const smAdvisors = await storage.getAdvisorsByAdmin(row.adminId);
      smAdvisors.forEach((a: any) => visibleIds.add(a.id));
    }

    return res.json(await storage.getClientsByAdvisors([...visibleIds]));
  }

  // Fallback
  return res.json(await storage.getClients(companyId));
});

clientsRouter.get("/api/clients/:id", isAuthenticated, async (req: any, res) => {
  const clientId = Number(req.params.id);
  if (!(await verifyClientOwnership(req, res, clientId))) return;
  const client = await storage.getClient(clientId);
  if (!client) return res.status(404).json({ message: "Client not found" });
  res.json(client);
});

clientsRouter.post("/api/clients", isAuthenticated, async (req: any, res) => {
  try {
    const input = api.clients.create.input
      .extend({
        advisorId: z.coerce.number().optional().nullable(),
        spouseId: z.coerce.number().optional().nullable(),
      })
      .parse(req.body);
    const companyId = await getCompanyId(req);
    const client = await storage.createClient({ ...input, companyId });
    if (client.spouseId) {
      await storage.updateClient(client.spouseId, { spouseId: client.id });
    }
    res.status(201).json(client);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      });
    }
    throw err;
  }
});

clientsRouter.put("/api/clients/:id", isAuthenticated, async (req: any, res) => {
  try {
    const clientId = Number(req.params.id);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const existing = await storage.getClient(clientId);
    if (!existing) return res.status(404).json({ message: "Client not found" });
    const input = api.clients.update.input.parse(req.body);
    const oldSpouseId = existing.spouseId;
    const newSpouseId = input.spouseId !== undefined ? input.spouseId : oldSpouseId;
    const client = await storage.updateClient(clientId, input);
    if (oldSpouseId !== newSpouseId) {
      if (oldSpouseId) await storage.updateClient(oldSpouseId, { spouseId: null });
      if (newSpouseId) {
        const newSpouse = await storage.getClient(newSpouseId);
        if (newSpouse?.spouseId && newSpouse.spouseId !== clientId) {
          await storage.updateClient(newSpouse.spouseId, { spouseId: null });
        }
        await storage.updateClient(newSpouseId, { spouseId: clientId });
      }
    }
    res.json(client);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      });
    }
    throw err;
  }
});

// PATCH is an alias for PUT — ClientProfileSection uses PATCH
clientsRouter.patch("/api/clients/:id", isAuthenticated, async (req: any, res) => {
  try {
    const clientId = Number(req.params.id);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const existing = await storage.getClient(clientId);
    if (!existing) return res.status(404).json({ message: "Client not found" });
    const input = insertClientSchema.partial().parse(req.body);
    const client = await storage.updateClient(clientId, input);
    res.json(client);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      });
    }
    throw err;
  }
});

// ── Children ──────────────────────────────────────────────────────────────────

clientsRouter.get("/api/clients/:clientId/children", isAuthenticated, async (req: any, res) => {
  const clientId = Number(req.params.clientId);
  if (!(await verifyClientOwnership(req, res, clientId))) return;
  res.json(await storage.getChildrenByClient(clientId));
});

clientsRouter.post("/api/clients/:clientId/children", isAuthenticated, async (req: any, res) => {
  try {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const input = api.children.create.input.parse(req.body);
    res.status(201).json(await storage.createChild({ ...input, clientId }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      });
    }
    throw err;
  }
});

clientsRouter.put("/api/children/:id", isAuthenticated, denyHostUsers, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, children, id))) return;
    const input = api.children.update.input.parse(req.body);
    const child = await storage.updateChild(id, input);
    if (!child) return res.status(404).json({ message: "Child not found" });
    res.json(child);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      });
    }
    throw err;
  }
});

clientsRouter.delete("/api/children/:id", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const id = Number(req.params.id);
  if (!(await verifyFpRecordOwnership(req, res, children, id))) return;
  await storage.deleteChild(id);
  res.status(204).send();
});

// ── Documents ─────────────────────────────────────────────────────────────────

clientsRouter.get("/api/clients/:clientId/documents", isAuthenticated, async (req: any, res) => {
  const clientId = Number(req.params.clientId);
  if (!(await verifyClientOwnership(req, res, clientId))) return;
  res.json(await storage.getDocumentsByClient(clientId));
});

clientsRouter.post("/api/clients/:clientId/documents", isAuthenticated, async (req: any, res) => {
  try {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const input = api.documents.create.input.parse(req.body);
    res.status(201).json(await storage.createDocument({ ...input, clientId }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      });
    }
    throw err;
  }
});

clientsRouter.put("/api/documents/:id", isAuthenticated, denyHostUsers, async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, documents, id))) return;
    const input = api.documents.update.input.parse(req.body);
    const doc = await storage.updateDocument(id, input);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    res.json(doc);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      });
    }
    throw err;
  }
});

clientsRouter.delete("/api/documents/:id", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const id = Number(req.params.id);
  if (!(await verifyFpRecordOwnership(req, res, documents, id))) return;
  await storage.deleteDocument(id);
  res.status(204).send();
});

// ── Activities ────────────────────────────────────────────────────────────────

clientsRouter.get("/api/clients/:clientId/activities", isAuthenticated, async (req: any, res) => {
  const clientId = Number(req.params.clientId);
  if (!(await verifyClientOwnership(req, res, clientId))) return;
  res.json(await storage.getActivitiesByClient(clientId));
});

clientsRouter.post("/api/clients/:clientId/activities", isAuthenticated, async (req: any, res) => {
  try {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const input = api.activities.create.input
      .extend({ date: z.coerce.date() })
      .parse(req.body);
    res.status(201).json(await storage.createActivity({ ...input, clientId }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      });
    }
    throw err;
  }
});

clientsRouter.delete("/api/activities/:id", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const id = Number(req.params.id);
  if (!(await verifyFpRecordOwnership(req, res, activities, id))) return;
  await storage.deleteActivity(id);
  res.status(204).send();
});

// ── Products ──────────────────────────────────────────────────────────────────

clientsRouter.get("/api/clients/:clientId/products", isAuthenticated, async (req: any, res) => {
  const clientId = Number(req.params.clientId);
  if (!(await verifyClientOwnership(req, res, clientId))) return;
  res.json(await storage.getProductsByClient(clientId));
});

clientsRouter.post("/api/clients/:clientId/products", isAuthenticated, async (req: any, res) => {
  try {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const input = api.products.create.input
      .extend({ value: z.coerce.string() })
      .parse(req.body);
    const caller = await getStaffFromSession(req);
    if (caller?.companyId) {
      const company = await storage.getCompany(caller.companyId);
      if (company) {
        const typeModuleMap: Record<
          string,
          "moduleInsurance" | "moduleMutualFund" | "moduleSegFund"
        > = {
          insurance: "moduleInsurance",
          mutual_fund: "moduleMutualFund",
          segregated_fund: "moduleSegFund",
        };
        const moduleKey = typeModuleMap[input.type];
        if (moduleKey && company[moduleKey] === false) {
          return res.status(403).json({
            message: `The ${input.type.replace("_", " ")} module is disabled for your company. Contact your General Manager to enable it.`,
          });
        }
      }
    }
    const allCarriers = await storage.getCarriers();
    const matchedCarrier = allCarriers.find(
      c => c.name.toLowerCase() === input.provider.toLowerCase()
    );
    if (!matchedCarrier) {
      return res.status(400).json({
        message: `Unknown carrier "${input.provider}". Must match a carrier in the system.`,
      });
    }
    if (matchedCarrier.type !== input.type) {
      return res.status(400).json({
        message: `Carrier "${input.provider}" is a ${matchedCarrier.type.replace("_", " ")} carrier, not ${input.type.replace("_", " ")}`,
      });
    }
    if (caller) {
      const advisorCarriers = await storage.getAdvisorCarriers(caller.id);
      if (!advisorCarriers.some(ac => ac.carrierId === matchedCarrier.id)) {
        return res.status(400).json({
          message: `Carrier "${input.provider}" is not in your selected carriers. Add it in Settings first.`,
        });
      }
    }
    res.status(201).json(await storage.createProduct({ ...input, clientId }));
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        message: err.errors[0].message,
        field: err.errors[0].path.join("."),
      });
    }
    throw err;
  }
});
