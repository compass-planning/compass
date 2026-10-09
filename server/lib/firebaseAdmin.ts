// server/lib/firebaseAdmin.ts
import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

let app: App;

if (!getApps().length) {
  app = initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
} else {
  app = getApp();
}

export const auth: Auth = getAuth(app);

export async function verifyFirebaseToken(token: string) {
  return auth.verifyIdToken(token);
}

export default app;