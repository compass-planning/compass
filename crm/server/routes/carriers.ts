import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { getCarrierAdapter, getAvailableFileTypes } from "../carrierAdapters";
import { carrierFileTypeOptions, type CarrierFileType } from "@shared/schema";
import type { CarrierCredentialInfo, CarrierClientInfo } from "../carrierAdapters";
import { getStaffFromSession, getCompanyId, requireRole, denyHostUsers, verifyClientOwnership } from "./middleware";

export const carriersRouter = Router();

// ── Carrier list ──────────────────────────────────────────────────────────────

carriersRouter.get("/api/carriers", isAuthenticated, async (_req, res) => {
  res.json(await storage.getCarriers());
});

carriersRouter.get("/api/my-carriers", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const caller = await getStaffFromSession(req);
  if (!caller) return res.status(401).json({ message: "Not authenticated" });
  res.json(await storage.getAdvisorCarriers(caller.id));
});

carriersRouter.post("/api/my-carriers", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const caller = await getStaffFromSession(req);
  if (!caller) return res.status(401).json({ message: "Not authenticated" });
  const { carrierId } = req.body;
  if (!carrierId || typeof carrierId !== "number") {
    return res.status(400).json({ message: "carrierId is required" });
  }
  const allCarriers = await storage.getCarriers();
  if (!allCarriers.some(c => c.id === carrierId)) {
    return res.status(400).json({ message: "Invalid carrier ID" });
  }
  const existing = await storage.getAdvisorCarriers(caller.id);
  if (existing.some(ac => ac.carrierId === carrierId)) {
    return res.status(409).json({ message: "Carrier already added" });
  }
  res.status(201).json(await storage.addAdvisorCarrier({ staffId: caller.id, carrierId }));
});

carriersRouter.delete("/api/my-carriers/:carrierId", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const caller = await getStaffFromSession(req);
  if (!caller) return res.status(401).json({ message: "Not authenticated" });
  await storage.removeAdvisorCarrier(caller.id, Number(req.params.carrierId));
  res.json({ success: true });
});

// ── CSV product import ────────────────────────────────────────────────────────

carriersRouter.post("/api/products/import", isAuthenticated, denyHostUsers, async (req: any, res) => {
  try {
    const caller = await getStaffFromSession(req);
    if (!caller) return res.status(401).json({ message: "Not authenticated" });

    const schema = z.object({
      rows: z.array(
        z.object({
          clientName: z.string().optional(),
          clientId: z.number().optional(),
          type: z.enum(["insurance", "mutual_fund", "segregated_fund"]),
          provider: z.string().min(1),
          policyNumber: z.string().min(1),
          value: z.string().min(1),
          status: z.enum(["active", "pending", "closed"]).default("active"),
        })
      ),
    });

    const { rows } = schema.parse(req.body);
    const companyClients = await storage.getClients(caller.companyId ?? undefined);
    const clientMap = new Map<string, number>();
    for (const c of companyClients) {
      clientMap.set(`${c.firstName} ${c.lastName}`.toLowerCase(), c.id);
    }

    const company = caller.companyId ? await storage.getCompany(caller.companyId) : null;
    const typeModuleMap: Record<string, "moduleInsurance" | "moduleMutualFund" | "moduleSegFund"> = {
      insurance: "moduleInsurance",
      mutual_fund: "moduleMutualFund",
      segregated_fund: "moduleSegFund",
    };

    const allCarriers = await storage.getCarriers();
    const carrierNameTypeMap = new Map(allCarriers.map(c => [c.name.toLowerCase(), c.type]));
    const advisorCarriers = await storage.getAdvisorCarriers(caller.id);
    const advisorCarrierNames = new Set(advisorCarriers.map(ac => ac.carrier.name.toLowerCase()));

    const errors: { row: number; message: string }[] = [];
    const validProducts: {
      clientId: number; type: string; provider: string;
      policyNumber: string; value: string; status: string;
    }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let resolvedClientId: number | undefined;

      if (row.clientId) {
        const client = companyClients.find(c => c.id === row.clientId);
        if (!client) {
          errors.push({ row: i + 1, message: `Client ID ${row.clientId} not found in your company` });
          continue;
        }
        resolvedClientId = client.id;
      } else if (row.clientName) {
        resolvedClientId = clientMap.get(row.clientName.toLowerCase());
        if (!resolvedClientId) {
          errors.push({ row: i + 1, message: `Client "${row.clientName}" not found` });
          continue;
        }
      } else {
        errors.push({ row: i + 1, message: "Either clientName or clientId is required" });
        continue;
      }

      if (company) {
        const moduleKey = typeModuleMap[row.type];
        if (moduleKey && company[moduleKey] === false) {
          errors.push({ row: i + 1, message: `${row.type.replace("_", " ")} module is disabled` });
          continue;
        }
      }

      const carrierType = carrierNameTypeMap.get(row.provider.toLowerCase());
      if (!carrierType) {
        errors.push({ row: i + 1, message: `Unknown carrier "${row.provider}". Must match a carrier in the system.` });
        continue;
      }
      if (carrierType !== row.type) {
        errors.push({ row: i + 1, message: `Carrier "${row.provider}" is a ${carrierType.replace("_", " ")} carrier, not ${row.type.replace("_", " ")}` });
        continue;
      }
      if (!advisorCarrierNames.has(row.provider.toLowerCase())) {
        errors.push({ row: i + 1, message: `Carrier "${row.provider}" is not in your selected carriers. Add it in Settings first.` });
        continue;
      }
      const numValue = parseFloat(row.value);
      if (isNaN(numValue) || numValue < 0) {
        errors.push({ row: i + 1, message: `Invalid value "${row.value}"` });
        continue;
      }
      validProducts.push({
        clientId: resolvedClientId, type: row.type, provider: row.provider,
        policyNumber: row.policyNumber, value: row.value, status: row.status,
      });
    }

    let imported: Awaited<ReturnType<typeof storage.bulkCreateProducts>> = [];
    if (validProducts.length > 0) {
      imported = await storage.bulkCreateProducts(validProducts);
      const { insertStaleFlagsForClient, recalculatePlan } = await import("../services/planRecalculation");
      const affectedClientIds = [...new Set(imported.map(p => p.clientId))];
      const recalcQueue: number[] = [];
      for (const cId of affectedClientIds) {
        const flagCount = await insertStaleFlagsForClient(cId, "carrier_file_import");
        if (flagCount > 0) {
          const clientPlans = await storage.getPlansByClient(cId);
          for (const plan of clientPlans) {
            const assumptions = await storage.getPlanAssumptions(plan.id);
            if (assumptions.length > 0) recalcQueue.push(plan.id);
          }
        }
      }
      if (recalcQueue.length > 0) {
        (async () => {
          for (const pId of recalcQueue) {
            try { await recalculatePlan(pId); }
            catch (err: unknown) { console.error(`Recalculation failed for plan ${pId}:`, err instanceof Error ? err.message : err); }
          }
        })().catch(() => {});
      }
    }

    res.json({ totalRows: rows.length, imported: imported.length, errors });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

// ── Carrier credentials ───────────────────────────────────────────────────────

carriersRouter.get("/api/carrier-credentials", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const companyId = await getCompanyId(req);
  if (!companyId) return res.status(403).json({ message: "Access denied" });
  const creds = await storage.getCarrierCredentialsByCompany(companyId);
  res.json(creds.map(({ _encryptedCredentials, ...rest }) => ({ ...rest, hasCredentials: true })));
});

carriersRouter.post(
  "/api/carrier-credentials",
  isAuthenticated, denyHostUsers,
  requireRole("general_manager", "office_admin"),
  async (req: any, res) => {
    try {
      const companyId = await getCompanyId(req);
      if (!companyId) return res.status(403).json({ message: "Access denied" });
      const input = z.object({
        carrierId: z.coerce.number(),
        credentialType: z.enum(["advisor_code", "api_key", "username_password"]),
        label: z.string().min(1),
        encryptedCredentials: z.string().min(1),
      }).parse(req.body);
      const carrier = (await storage.getCarriers()).find(c => c.id === input.carrierId);
      if (!carrier) return res.status(404).json({ message: "Carrier not found" });
      const cred = await storage.createCarrierCredential({ ...input, companyId, isActive: true });
      const { _encryptedCredentials, ...safe } = cred;
      res.status(201).json({ ...safe, hasCredentials: true });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  }
);

carriersRouter.delete(
  "/api/carrier-credentials/:id",
  isAuthenticated, denyHostUsers,
  requireRole("general_manager", "office_admin"),
  async (req: any, res) => {
    const companyId = await getCompanyId(req);
    if (!companyId) return res.status(403).json({ message: "Access denied" });
    const cred = await storage.getCarrierCredential(Number(req.params.id));
    if (!cred || cred.companyId !== companyId) return res.status(404).json({ message: "Credential not found" });
    await storage.deleteCarrierCredential(cred.id);
    res.status(204).send();
  }
);

// ── Carrier file requests ─────────────────────────────────────────────────────

carriersRouter.post(
  "/api/clients/:clientId/carrier-files/request",
  isAuthenticated, denyHostUsers,
  async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
      if (!(await verifyClientOwnership(req, res, clientId))) return;

      const member = await getStaffFromSession(req);
      if (!member) return res.status(403).json({ message: "Access denied" });
      const companyId = member.companyId;
      if (!companyId) return res.status(403).json({ message: "Access denied" });

      const input = z.object({
        carrierId: z.coerce.number(),
        fileTypes: z.array(z.enum(carrierFileTypeOptions)).min(1),
      }).parse(req.body);

      const carrier = (await storage.getCarriers()).find(c => c.id === input.carrierId);
      if (!carrier) return res.status(404).json({ message: "Carrier not found" });

      const advisorCarrierLinks = await storage.getAdvisorCarriers(member.id);
      if (!advisorCarrierLinks.some(ac => ac.carrier.id === input.carrierId)) {
        return res.status(403).json({ message: "You are not authorized to request files from this carrier. Please link this carrier to your profile first." });
      }

      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const companyCreds = await storage.getCarrierCredentialsByCompany(companyId);
      const activeCred = companyCreds.find(c => c.carrierId === input.carrierId && c.isActive);
      const credentialInfo: CarrierCredentialInfo | null = activeCred
        ? { credentialType: activeCred.credentialType, credentials: activeCred.encryptedCredentials }
        : null;

      const clientInfo: CarrierClientInfo = {
        clientId: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
      };

      const fileRequest = await storage.createCarrierFileRequest({
        companyId, clientId, carrierId: input.carrierId,
        staffId: member.id, status: "pending",
        fileTypes: input.fileTypes, errorMessage: null,
      });
      await storage.updateCarrierFileRequest(fileRequest.id, { status: "processing" });

      const adapter = getCarrierAdapter(carrier.name);
      const fileTypeLabels: Record<string, string> = {
        policy_statement: "Policy Statement", tax_slip: "Tax Slip",
        account_summary: "Account Summary", transaction_history: "Transaction History",
        confirmation_of_coverage: "Confirmation of Coverage", beneficiary_summary: "Beneficiary Summary",
      };

      try {
        const result = await adapter.requestFiles(credentialInfo, clientInfo, input.fileTypes as CarrierFileType[]);

        for (const file of result.files) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 30);
          const carrierFile = await storage.createCarrierFile({
            requestId: fileRequest.id, carrierId: input.carrierId,
            clientId, companyId, fileType: file.fileType, fileName: file.fileName,
            mimeType: file.mimeType, fileSizeBytes: file.fileSizeBytes,
            status: "available", demoContent: file.content, expiresAt,
          });

          const existingDocs = await storage.getDocumentsByClient(clientId);
          if (!existingDocs.some(d => d.fileName === `carrier-file:${carrierFile.id}`)) {
            await storage.createDocument({
              clientId,
              title: `${carrier.name} — ${fileTypeLabels[file.fileType] ?? file.fileType}`,
              documentType: "carrier_download",
              description: `Auto-downloaded from ${carrier.name}. File: ${file.fileName}`,
              signedDate: new Date().toISOString().split("T")[0],
              fileName: `carrier-file:${carrierFile.id}`,
              status: "signed",
            });
          }

          if (file.productData) {
            const existingProducts = await storage.getProductsByClient(clientId);
            const existing = existingProducts.find(
              p => p.provider === carrier.name && p.policyNumber === file.productData!.policyNumber
            );
            if (existing) {
              await storage.updateProduct(existing.id, {
                value: file.productData.value, status: file.productData.status,
              });
            } else {
              await storage.createProduct({
                clientId, type: carrier.type, provider: carrier.name,
                policyNumber: file.productData.policyNumber,
                value: file.productData.value, status: file.productData.status,
              });
            }
          }
        }

        const updated = await storage.updateCarrierFileRequest(fileRequest.id, {
          status: result.status, completedAt: new Date(),
          errorMessage: result.errorMessage ?? null,
        });

        if (result.status === "completed" || result.files.length > 0) {
          const { insertStaleFlagsForClient, recalculatePlan } = await import("../services/planRecalculation");
          const flagCount = await insertStaleFlagsForClient(clientId, "carrier_file_sync");
          if (flagCount > 0) {
            const recalcQueue: number[] = [];
            const clientPlans = await storage.getPlansByClient(clientId);
            for (const plan of clientPlans) {
              const assumptions = await storage.getPlanAssumptions(plan.id);
              if (assumptions.length > 0) recalcQueue.push(plan.id);
            }
            if (recalcQueue.length > 0) {
              (async () => {
                for (const pId of recalcQueue) {
                  try { await recalculatePlan(pId); }
                  catch (err: unknown) { console.error(`Recalculation failed for plan ${pId}:`, err); }
                }
              })().catch(() => {});
            }
          }
        }

        const files = await storage.getCarrierFilesByRequest(fileRequest.id);
        res.status(201).json({ request: updated, files: files.map(f => ({ ...f, demoContent: undefined })) });
      } catch (adapterErr: unknown) {
        const errMsg = adapterErr instanceof Error ? adapterErr.message : "Unknown adapter error";
        const updated = await storage.updateCarrierFileRequest(fileRequest.id, {
          status: "failed", completedAt: new Date(), errorMessage: errMsg,
        });
        res.status(201).json({ request: updated, files: [] });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  }
);

carriersRouter.get("/api/clients/:clientId/carrier-files", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const clientId = Number(req.params.clientId);
  if (isNaN(clientId)) return res.status(400).json({ message: "Invalid client ID" });
  if (!(await verifyClientOwnership(req, res, clientId))) return;
  const companyId = await getCompanyId(req);
  if (!companyId) return res.status(403).json({ message: "Access denied" });
  const requests = await storage.getCarrierFileRequestsByClient(clientId, companyId);
  const files = await storage.getCarrierFilesByClient(clientId, companyId);
  const carrierMap = new Map((await storage.getCarriers()).map(c => [c.id, c.name]));
  res.json({
    requests: requests.map(r => ({ ...r, carrierName: carrierMap.get(r.carrierId) ?? "Unknown" })),
    files: files.map(f => ({ ...f, demoContent: undefined, carrierName: carrierMap.get(f.carrierId) ?? "Unknown" })),
  });
});

carriersRouter.get("/api/carrier-file-requests/:requestId", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const requestId = Number(req.params.requestId);
  if (isNaN(requestId)) return res.status(400).json({ message: "Invalid request ID" });
  const companyId = await getCompanyId(req);
  if (!companyId) return res.status(403).json({ message: "Access denied" });
  const fileReq = await storage.getCarrierFileRequestByIdAndCompany(requestId, companyId);
  if (!fileReq) return res.status(404).json({ message: "Request not found" });
  const carriers = await storage.getCarriers();
  const carrier = carriers.find(c => c.id === fileReq.carrierId);
  if (fileReq.status === "processing" && carrier) {
    const adapter = getCarrierAdapter(carrier.name);
    const adapterStatus = await adapter.getRequestStatus(String(fileReq.id));
    if (adapterStatus.status !== "processing") {
      await storage.updateCarrierFileRequest(fileReq.id, {
        status: adapterStatus.status, completedAt: new Date(),
        errorMessage: adapterStatus.errorMessage ?? null,
      });
      fileReq.status = adapterStatus.status;
      fileReq.errorMessage = adapterStatus.errorMessage ?? null;
    }
  }
  const files = await storage.getCarrierFilesByRequest(requestId);
  res.json({ ...fileReq, carrierName: carrier?.name ?? "Unknown", files: files.map(f => ({ ...f, demoContent: undefined })) });
});

carriersRouter.get("/api/carrier-files/:fileId/download", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const fileId = Number(req.params.fileId);
  if (isNaN(fileId)) return res.status(400).json({ message: "Invalid file ID" });
  const companyId = await getCompanyId(req);
  if (!companyId) return res.status(403).json({ message: "Access denied" });
  const file = await storage.getCarrierFileByIdAndCompany(fileId, companyId);
  if (!file) return res.status(404).json({ message: "File not found" });
  if (file.status !== "available") return res.status(410).json({ message: "File is no longer available" });
  if (file.expiresAt && new Date(file.expiresAt) < new Date()) {
    return res.status(410).json({ message: "File has expired" });
  }
  if (!file.demoContent) return res.status(404).json({ message: "File content not available" });
  const buffer = Buffer.from(file.demoContent, "base64");
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
  res.setHeader("Content-Length", buffer.length);
  res.send(buffer);
});

carriersRouter.get("/api/carrier-file-types/:carrierId", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const carrierId = Number(req.params.carrierId);
  if (isNaN(carrierId)) return res.status(400).json({ message: "Invalid carrier ID" });
  const carrier = (await storage.getCarriers()).find(c => c.id === carrierId);
  if (!carrier) return res.status(404).json({ message: "Carrier not found" });
  res.json(getAvailableFileTypes(carrier.name));
});
