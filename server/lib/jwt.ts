/**
 * server/lib/jwt.ts
 * Signs and verifies session JWTs.
 * Secret stored in JWT_SECRET Fly secret (min 32 chars).
 */

import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error("JWT_SECRET env var must be set and at least 32 characters");
}

export interface SessionPayload {
  userId:       number;
  jurisdiction: "CA" | "US";
  mfaVerified:  boolean;  // true only after TOTP step is passed
}

const ACCESS_TTL  = "8h";   // matches previous session TTL
const REFRESH_TTL = "30d";  // long-lived refresh token

export function signAccessToken(payload: SessionPayload): string {
  return jwt.sign(payload, SECRET!, { expiresIn: ACCESS_TTL, algorithm: "HS256" });
}

export function signRefreshToken(userId: number): string {
  return jwt.sign({ userId, type: "refresh" }, SECRET!, { expiresIn: REFRESH_TTL, algorithm: "HS256" });
}

export function verifyAccessToken(token: string): SessionPayload {
  const decoded = jwt.verify(token, SECRET!, { algorithms: ["HS256"] }) as any;
  if (!decoded.userId || typeof decoded.mfaVerified !== "boolean") {
    throw new Error("Invalid token payload");
  }
  return {
    userId:       decoded.userId,
    jurisdiction: decoded.jurisdiction ?? "CA",
    mfaVerified:  decoded.mfaVerified,
  };
}

export function verifyRefreshToken(token: string): { userId: number } {
  const decoded = jwt.verify(token, SECRET!, { algorithms: ["HS256"] }) as any;
  if (decoded.type !== "refresh") throw new Error("Not a refresh token");
  return { userId: decoded.userId };
}
