/**
 * server/lib/firebaseAdmin.ts
 * Firebase Admin SDK — verifies ID tokens on the server.
 * Service account stored as base64 in FIREBASE_SERVICE_ACCOUNT_B64.
 */
import admin from "firebase-admin";

let initialized = false;

export function getFirebaseAdmin(): admin.app.App {
  if (!initialized) {
    const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
    if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 not set");

    const serviceAccount = JSON.parse(
      Buffer.from(b64, "base64").toString("utf-8")
    );

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
  }
  return admin.app();
}

export async function verifyFirebaseToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
  const app = getFirebaseAdmin();
  return app.auth().verifyIdToken(idToken);
}
