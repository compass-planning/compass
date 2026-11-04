import { Router } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { getStaffFromSession } from "./middleware";

export const notificationsRouter = Router();

notificationsRouter.get("/", isAuthenticated, async (req: any, res) => {
  const member = await getStaffFromSession(req);
  if (!member) return res.status(404).json({ message: "Staff not found" });
  res.json(await storage.getRecentNotifications(member.id, 50));
});

notificationsRouter.get(
  "/unread-count",
  isAuthenticated,
  async (req: any, res) => {
    const member = await getStaffFromSession(req);
    if (!member) return res.status(404).json({ message: "Staff not found" });
    const unread = await storage.getUnreadNotifications(member.id);
    res.json({ count: unread.length });
  },
);

// Persistent daily briefing (popup + sidebar page). Unlike /digest it does not depend on
// "since last login", so it can be reopened any time.
notificationsRouter.get("/briefing", isAuthenticated, async (req: any, res) => {
  const member = await getStaffFromSession(req);
  if (!member) return res.status(404).json({ message: "Staff not found" });
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = await storage.getRecentNotifications(member.id, 50);
  const notifications = recent.filter((n: any) => !n.createdAt || new Date(n.createdAt).getTime() >= weekAgo);
  const birthdays = member.companyId ? await storage.getUpcomingBirthdays(member.companyId, 7) : [];
  const horizon = new Date(); horizon.setDate(horizon.getDate() + 7);
  const horizonStr = horizon.toISOString().slice(0, 10);
  const allTasks = member.companyId ? await storage.getTasksForStaff(member.id, member.companyId) : [];
  const tasks = allTasks
    .filter((t: any) => t.status !== "completed" && t.status !== "cancelled" && t.dueDate && String(t.dueDate).slice(0, 10) <= horizonStr)
    .sort((a: any, b: any) => String(a.dueDate).localeCompare(String(b.dueDate)));
  res.json({ generatedAt: new Date().toISOString(), notifications, birthdays, tasks });
});

notificationsRouter.get("/digest", isAuthenticated, async (req: any, res) => {
  const member = await getStaffFromSession(req);
  if (!member) return res.status(404).json({ message: "Staff not found" });
  const sinceLogin = await storage.getNotificationsSinceLastLogin(
    member.id,
    member.lastLoginAt,
  );
  const birthdays = member.companyId
    ? await storage.getUpcomingBirthdays(member.companyId, 7)
    : [];
  res.json({ notifications: sinceLogin, birthdays });
});

notificationsRouter.put("/:id/read", isAuthenticated, async (req: any, res) => {
  const member = await getStaffFromSession(req);
  if (!member) return res.status(404).json({ message: "Staff not found" });
  const notification = await storage.markNotificationAsReadForRecipient(
    Number(req.params.id),
    member.id,
  );
  if (!notification)
    return res.status(404).json({ message: "Notification not found" });
  res.json(notification);
});

notificationsRouter.put("/read-all", isAuthenticated, async (req: any, res) => {
  const member = await getStaffFromSession(req);
  if (!member) return res.status(404).json({ message: "Staff not found" });
  await storage.markAllNotificationsAsRead(member.id);
  res.json({ success: true });
});

notificationsRouter.post(
  "/dismiss-digest",
  isAuthenticated,
  async (req: any, res) => {
    const member = await getStaffFromSession(req);
    if (!member) return res.status(404).json({ message: "Staff not found" });
    await storage.updateStaffLastLogin(member.id);
    res.json({ success: true });
  },
);
