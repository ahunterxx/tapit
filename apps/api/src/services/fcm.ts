import admin from "firebase-admin";

let initialized = false;

function getApp(): admin.app.App | null {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return null;
  }

  if (!initialized) {
    const credentials = require(require("path").resolve(
      process.env.GOOGLE_APPLICATION_CREDENTIALS
    ));
    admin.initializeApp({
      credential: admin.credential.cert(credentials),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    initialized = true;
  }

  return admin.app();
}

export async function sendFcmNotification(params: {
  fcmToken: string;
  title: string;
  body: string;
}): Promise<boolean> {
  const app = getApp();
  if (!app) {
    console.warn("[FCM] Not configured — skipping FCM notification");
    return false;
  }

  try {
    await admin.messaging(app).send({
      token: params.fcmToken,
      notification: { title: params.title, body: params.body },
      android: { priority: "high" },
    });
    return true;
  } catch (err) {
    console.error("[FCM] Error sending notification:", err);
    return false;
  }
}

export function isFcmConfigured(): boolean {
  return !!(process.env.FIREBASE_PROJECT_ID && process.env.GOOGLE_APPLICATION_CREDENTIALS);
}
