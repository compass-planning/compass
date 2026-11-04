import type { Express } from "express";
import { validate, loginSchema, registerSchema, changePasswordSchema, mfaTokenSchema, mfaRecoverySchema } from "../schemas";
import { validatePassword } from "./passwordPolicy";
import { hashUserAgent } from "./session";
import { pool } from "../db";
import { isAuthenticated } from "./session";
import { db } from "../db";
import { staff, hostUsers } from "@shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logger } from "../logger";

export function registerAuthRoutes(app: Express): void {
  app.post("/api/auth/login", validate(loginSchema), async (req: any, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return res
          .status(400)
          .json({ message: "Email and password are required" });
      const normalizedEmail = email.toLowerCase().trim();

      // Check host users first
      const [hostUser] = await db
        .select()
        .from(hostUsers)
        .where(eq(hostUsers.email, normalizedEmail));
      if (hostUser && hostUser.isActive && hostUser.passwordHash) {
        const valid = await bcrypt.compare(password, hostUser.passwordHash);
        if (valid) {
          return new Promise<void>((resolve, reject) => {
            req.session.regenerate((err: any) => {
              if (err) return reject(err);
              req.session.hostUserId  = hostUser.id;
              req.session.userType    = "host";
              req.session.createdAt   = Date.now();
              req.session.uaHash      = hashUserAgent(req.headers["user-agent"]);
              // Host users are super-admins — no MFA required for now
              req.session.mfaEnabled  = false;
              req.session.mfaVerified = true;
              req.session.save((saveErr: any) => {
                if (saveErr) return reject(saveErr);
                res.json({
                  id: String(hostUser.id),
                  email: hostUser.email,
                  firstName: hostUser.firstName,
                  lastName: hostUser.lastName,
                  profileImageUrl: null,
                });
                resolve();
              });
            });
          });
        }
      }

      // Check staff
      const [staffMember] = await db
        .select()
        .from(staff)
        .where(eq(staff.email, normalizedEmail));
      if (!staffMember)
        return res.status(401).json({ message: "Invalid email or password" });
      if (!staffMember.passwordHash)
        return res
          .status(401)
          .json({ message: "Password not set. Contact your administrator." });
      const valid = await bcrypt.compare(password, staffMember.passwordHash);
      if (!valid)
        return res.status(401).json({ message: "Invalid email or password" });

      return new Promise<void>((resolve, reject) => {
        req.session.regenerate((err: any) => {
          if (err) return reject(err);
          req.session.staffId    = staffMember.id;
          req.session.userType   = "staff";
          req.session.createdAt  = Date.now();
          req.session.uaHash     = hashUserAgent(req.headers["user-agent"]);
          req.session.mfaEnabled  = (staffMember as any).mfaEnabled ?? false;
          req.session.mfaVerified = !((staffMember as any).mfaEnabled);
          req.session.save((saveErr: any) => {
            if (saveErr) return reject(saveErr);
            // If MFA is enabled, return mfaRequired so the client shows the TOTP screen
            if ((staffMember as any).mfaEnabled) {
              res.json({ mfaRequired: true });
            } else {
              res.json({
                id: String(staffMember.id),
                email: staffMember.email,
                firstName: staffMember.firstName,
                lastName: staffMember.lastName,
                profileImageUrl: null,
                mustChangePassword: staffMember.mustChangePassword ?? false,
              });
            }
            resolve();
          });
        });
      });
    } catch (error) {
      logger.error("Login error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/auth/register", validate(registerSchema), async (req: any, res) => {
    try {
      const { companyName, firstName, lastName, email, password } = req.body;
      if (!companyName || !firstName || !lastName || !email || !password)
        return res.status(400).json({ message: "All fields are required" });
      const pwdCheck = validatePassword(password);
      if (!pwdCheck.valid)
        return res.status(400).json({ message: pwdCheck.message });
      const normalizedEmail = email.toLowerCase().trim();
      const [existing] = await db
        .select()
        .from(staff)
        .where(eq(staff.email, normalizedEmail));
      if (existing)
        return res
          .status(409)
          .json({ message: "An account with this email already exists" });

      const { storage } = await import("../storage");
      const company = await storage.createCompany({ name: companyName });
      const passwordHash = await bcrypt.hash(password, 12);
      const [newStaff] = await db
        .insert(staff)
        .values({
          companyId: company.id,
          firstName,
          lastName,
          email: normalizedEmail,
          passwordHash,
          role: "general_manager",
          isAdmin: false,
        })
        .returning();

      return new Promise<void>((resolve, reject) => {
        req.session.regenerate((err: any) => {
          if (err) return reject(err);
          req.session.staffId    = newStaff.id;
          req.session.userType   = "staff";
          req.session.createdAt  = Date.now();
          req.session.uaHash     = hashUserAgent(req.headers["user-agent"]);
          req.session.mfaEnabled  = false;
          req.session.mfaVerified = true;  // No MFA yet — enrolled later
          req.session.save((saveErr: any) => {
            if (saveErr) return reject(saveErr);
            res
              .status(201)
              .json({
                id: String(newStaff.id),
                email: newStaff.email,
                firstName: newStaff.firstName,
                lastName: newStaff.lastName,
                profileImageUrl: null,
              });
            resolve();
          });
        });
      });
    } catch (error) {
      logger.error("Registration error:", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      if (req.session.hostUserId) {
        const [hostUser] = await db
          .select()
          .from(hostUsers)
          .where(eq(hostUsers.id, req.session.hostUserId));
        if (!hostUser) return res.status(401).json({ message: "Unauthorized" });
        return res.json({
          id: String(hostUser.id),
          email: hostUser.email,
          firstName: hostUser.firstName,
          lastName: hostUser.lastName,
          profileImageUrl: null,
        });
      }
      if (req.session.staffId) {
        const [staffMember] = await db
          .select()
          .from(staff)
          .where(eq(staff.id, req.session.staffId));
        if (!staffMember)
          return res.status(401).json({ message: "Unauthorized" });
        return res.json({
          id: String(staffMember.id),
          email: staffMember.email,
          firstName: staffMember.firstName,
          lastName: staffMember.lastName,
          profileImageUrl: null,
          mustChangePassword: staffMember.mustChangePassword ?? false,
        });
      }
      return res.status(401).json({ message: "Unauthorized" });
    } catch (error) {
      logger.error("Error fetching user:", error);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      res.clearCookie("connect.sid");
      return res.json({ message: "Logged out" });
    });
  });

  app.get("/api/logout", (req: any, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/crm/login");
    });
  });

  app.post(
    "/api/auth/change-password",
    validate(changePasswordSchema),
    isAuthenticated,
    async (req: any, res) => {
      try {
        const { currentPassword, newPassword } = req.body;
        const pwdCheck = validatePassword(newPassword);
        if (!pwdCheck.valid)
          return res.status(400).json({ message: pwdCheck.message });

        if (req.session.staffId) {
          const [member] = await db
            .select()
            .from(staff)
            .where(eq(staff.id, req.session.staffId));
          if (!member)
            return res.status(404).json({ message: "User not found" });
          if (member.passwordHash) {
            if (!currentPassword)
              return res
                .status(400)
                .json({ message: "Current password is required" });
            const valid = await bcrypt.compare(
              currentPassword,
              member.passwordHash,
            );
            if (!valid)
              return res
                .status(401)
                .json({ message: "Current password is incorrect" });
          }
          const hash = await bcrypt.hash(newPassword, 12);
          await db
            .update(staff)
            .set({ passwordHash: hash, mustChangePassword: false })
            .where(eq(staff.id, member.id));
          // Invalidate all sessions for this user — any stolen session is now dead
          await pool.query(
            `DELETE FROM sessions WHERE sess->>'staffId' = $1`,
            [String(member.id)]
          );
          return res.json({ message: "Password updated" });
        }
        if (req.session.hostUserId) {
          const [hostUser] = await db
            .select()
            .from(hostUsers)
            .where(eq(hostUsers.id, req.session.hostUserId));
          if (!hostUser)
            return res.status(404).json({ message: "User not found" });
          if (hostUser.passwordHash) {
            if (!currentPassword)
              return res
                .status(400)
                .json({ message: "Current password is required" });
            const valid = await bcrypt.compare(
              currentPassword,
              hostUser.passwordHash,
            );
            if (!valid)
              return res
                .status(401)
                .json({ message: "Current password is incorrect" });
          }
          const hash = await bcrypt.hash(newPassword, 12);
          await db
            .update(hostUsers)
            .set({ passwordHash: hash })
            .where(eq(hostUsers.id, hostUser.id));
          // Invalidate all sessions for this user — any stolen session is now dead
          await pool.query(
            `DELETE FROM sessions WHERE sess->>'hostUserId' = $1`,
            [String(hostUser.id)]
          );
          return res.json({ message: "Password updated" });
        }
        return res.status(401).json({ message: "Unauthorized" });
      } catch (error) {
        logger.error("Change password error:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    },
  );
}
