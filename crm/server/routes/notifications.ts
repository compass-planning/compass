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
