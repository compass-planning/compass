import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { insertTaskSchema } from "@shared/schema";
import { getStaffFromSession } from "./middleware";
import { getAssignableStaff } from "../access";

export const tasksRouter = Router();

tasksRouter.get("/", isAuthenticated, async (req: any, res) => {
  try {
    const currentStaff = await getStaffFromSession(req);
    if (!currentStaff?.companyId) return res.json([]);
    res.json(
      await storage.getTasksForStaff(currentStaff.id, currentStaff.companyId),
    );
  } catch {
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
});

tasksRouter.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const currentStaff = await getStaffFromSession(req);
    if (!currentStaff?.companyId)
      return res.status(403).json({ message: "No company" });

    const input = insertTaskSchema
      .omit({ companyId: true, createdByStaffId: true })
      .extend({
        assignedToStaffId: z.coerce.number().optional().nullable(),
        clientId: z.coerce.number().optional().nullable(),
        leadId: z.coerce.number().optional().nullable(),
      })
      .parse(req.body);

    if (input.assignedToStaffId) {
      const assignee = await storage.getStaffMember(input.assignedToStaffId);
      if (!assignee || assignee.companyId !== currentStaff.companyId) {
        return res
          .status(400)
          .json({ message: "Assignee must be a member of your company" });
      }
      // Same "who can I assign to" list as clients and pipeline deals (server/access.ts).
      if (!(await getAssignableStaff(currentStaff)).some(m => m.id === input.assignedToStaffId)) {
        return res.status(400).json({ message: "You can't assign a task to that person" });
      }
    }
    if (input.clientId && input.leadId) {
      return res
        .status(400)
        .json({
          message:
            "A task can be linked to either a client or a lead, not both",
        });
    }
    if (input.clientId) {
      const client = await storage.getClient(input.clientId);
      if (!client || client.companyId !== currentStaff.companyId) {
        return res
          .status(400)
          .json({ message: "Client not found in your company" });
      }
    }
    if (input.leadId) {
      const lead = await storage.getLead(input.leadId);
      if (!lead || lead.companyId !== currentStaff.companyId) {
        return res
          .status(400)
          .json({ message: "Lead not found in your company" });
      }
    }

    const task = await storage.createTask({
      ...input,
      companyId: currentStaff.companyId,
      createdByStaffId: currentStaff.id,
    });

    if (task.clientId) {
      await storage.createActivity({
        clientId: task.clientId,
        activityType: "follow_up",
        title: `Task created: ${task.title}`,
        description: task.description || null,
        date: new Date(),
        duration: null,
        staffId: currentStaff.id,
      });
    }
    if (task.leadId) {
      await storage.createLeadActivity({
        leadId: task.leadId,
        activityType: "follow_up",
        title: `Task created: ${task.title}`,
        description: task.description || null,
        date: new Date(),
        staffId: currentStaff.id,
      });
    }
    if (task.assignedToStaffId && task.assignedToStaffId !== currentStaff.id) {
      await storage.createNotification({
        companyId: currentStaff.companyId,
        recipientStaffId: task.assignedToStaffId,
        type: "task_assigned",
        title: `New task assigned: ${task.title}`,
        message: `Assigned by ${currentStaff.firstName} ${currentStaff.lastName}`,
        relatedEntityType: "task",
        relatedEntityId: task.id,
      });
    }

    res.status(201).json(task);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    res.status(500).json({ message: "Failed to create task" });
  }
});

tasksRouter.put("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const currentStaff = await getStaffFromSession(req);
    if (!currentStaff) return res.status(403).json({ message: "Forbidden" });

    const task = await storage.getTask(Number(req.params.id));
    if (!task || task.companyId !== currentStaff.companyId) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (
      task.createdByStaffId !== currentStaff.id &&
      task.assignedToStaffId !== currentStaff.id
    ) {
      return res
        .status(403)
        .json({ message: "Only the creator or assignee can update this task" });
    }

    const input = insertTaskSchema
      .omit({ companyId: true, createdByStaffId: true })
      .partial()
      .extend({
        assignedToStaffId: z.coerce.number().optional().nullable(),
        clientId: z.coerce.number().optional().nullable(),
        leadId: z.coerce.number().optional().nullable(),
      })
      .parse(req.body);

    if (input.assignedToStaffId) {
      const assignee = await storage.getStaffMember(input.assignedToStaffId);
      if (!assignee || assignee.companyId !== currentStaff.companyId) {
        return res
          .status(400)
          .json({ message: "Assignee must be a member of your company" });
      }
      // Same "who can I assign to" list as clients and pipeline deals (server/access.ts).
      if (input.assignedToStaffId !== task.assignedToStaffId && !(await getAssignableStaff(currentStaff)).some(m => m.id === input.assignedToStaffId)) {
        return res.status(400).json({ message: "You can't assign a task to that person" });
      }
    }

    const resolvedClientId =
      input.clientId !== undefined ? input.clientId : task.clientId;
    const resolvedLeadId =
      input.leadId !== undefined ? input.leadId : task.leadId;
    if (resolvedClientId && resolvedLeadId) {
      return res
        .status(400)
        .json({
          message:
            "A task can be linked to either a client or a lead, not both",
        });
    }
    if (input.clientId) {
      const linked = await storage.getClient(input.clientId);
      if (!linked || linked.companyId !== currentStaff.companyId) {
        return res
          .status(400)
          .json({ message: "Client not found in your company" });
      }
    }
    if (input.leadId) {
      const linked = await storage.getLead(input.leadId);
      if (!linked || linked.companyId !== currentStaff.companyId) {
        return res
          .status(400)
          .json({ message: "Lead not found in your company" });
      }
    }

    const updates: typeof input & { completedAt?: Date | null } = { ...input };
    if (input.status === "completed" && task.status !== "completed")
      updates.completedAt = new Date();
    else if (input.status && input.status !== "completed")
      updates.completedAt = null;

    const prevAssignee = task.assignedToStaffId;
    const clientChanged =
      input.clientId !== undefined && input.clientId !== task.clientId;
    const leadChanged =
      input.leadId !== undefined && input.leadId !== task.leadId;
    const newlyDone =
      input.status === "completed" && task.status !== "completed";

    const updated = await storage.updateTask(Number(req.params.id), updates);

    const reassigned =
      input.assignedToStaffId !== undefined &&
      input.assignedToStaffId !== prevAssignee &&
      input.assignedToStaffId !== null &&
      input.assignedToStaffId !== currentStaff.id;

    if (reassigned && updated.assignedToStaffId) {
      await storage.createNotification({
        companyId: currentStaff.companyId,
        recipientStaffId: updated.assignedToStaffId,
        type: "task_assigned",
        title: `Task assigned to you: ${updated.title}`,
        message: `Reassigned by ${currentStaff.firstName} ${currentStaff.lastName}`,
        relatedEntityType: "task",
        relatedEntityId: updated.id,
      });
    }
    if (clientChanged && updated.clientId) {
      await storage.createActivity({
        clientId: updated.clientId,
        activityType: "follow_up",
        title: `Task linked: ${updated.title}`,
        description: updated.description || null,
        date: new Date(),
        duration: null,
        staffId: currentStaff.id,
      });
    }
    if (leadChanged && updated.leadId) {
      await storage.createLeadActivity({
        leadId: updated.leadId,
        activityType: "follow_up",
        title: `Task linked: ${updated.title}`,
        description: updated.description || null,
        date: new Date(),
        staffId: currentStaff.id,
      });
    }
    if (newlyDone) {
      if (updated.clientId) {
        await storage.createActivity({
          clientId: updated.clientId,
          activityType: "follow_up",
          title: `Task completed: ${updated.title}`,
          description: updated.description || null,
          date: new Date(),
          duration: null,
          staffId: currentStaff.id,
        });
      }
      if (updated.leadId) {
        await storage.createLeadActivity({
          leadId: updated.leadId,
          activityType: "follow_up",
          title: `Task completed: ${updated.title}`,
          description: updated.description || null,
          date: new Date(),
          staffId: currentStaff.id,
        });
      }
    }

    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError)
      return res.status(400).json({ message: err.errors[0].message });
    res.status(500).json({ message: "Failed to update task" });
  }
});

tasksRouter.delete("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const currentStaff = await getStaffFromSession(req);
    if (!currentStaff) return res.status(403).json({ message: "Forbidden" });
    const task = await storage.getTask(Number(req.params.id));
    if (!task || task.companyId !== currentStaff.companyId) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (task.createdByStaffId !== currentStaff.id) {
      return res
        .status(403)
        .json({ message: "Only the creator can delete this task" });
    }
    await storage.deleteTask(Number(req.params.id));
    res.status(204).send();
  } catch {
    res.status(500).json({ message: "Failed to delete task" });
  }
});
