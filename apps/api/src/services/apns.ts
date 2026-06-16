/**
 * Apple Push Notification Service.
 * Sends silent pushes to trigger Apple Wallet pass refresh.
 * All functions are no-ops when Apple certs are not configured.
 */

export function isApnsConfigured(): boolean {
  return !!(
    process.env.APNS_KEY_PATH &&
    process.env.APNS_KEY_ID &&
    process.env.APPLE_TEAM_ID &&
    process.env.APNS_TOPIC
  );
}

export async function sendSilentPassUpdate(deviceToken: string): Promise<boolean> {
  if (!isApnsConfigured()) {
    console.warn("[APNS] Not configured — skipping silent push");
    return false;
  }

  try {
    const apn = await import("node-apn");
    const fs = await import("fs");
    const path = await import("path");

    const provider = new apn.default.Provider({
      token: {
        key: fs.readFileSync(path.resolve(process.env.APNS_KEY_PATH!)),
        keyId: process.env.APNS_KEY_ID!,
        teamId: process.env.APPLE_TEAM_ID!,
      },
      production: process.env.NODE_ENV === "production",
    });

    const notification = new apn.default.Notification();
    notification.topic = process.env.APNS_TOPIC!;
    notification.pushType = "background";
    notification.priority = 5;
    notification.payload = {};

    const result = await provider.send(notification, deviceToken);
    provider.shutdown();

    if (result.failed.length > 0) {
      console.error("[APNS] Push failed:", result.failed);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[APNS] Error sending push:", err);
    return false;
  }
}

export async function sendPushNotification(params: {
  deviceToken: string;
  title: string;
  body: string;
  topic: string;
}): Promise<boolean> {
  if (!isApnsConfigured()) {
    console.warn("[APNS] Not configured — skipping push notification");
    return false;
  }

  try {
    const apn = await import("node-apn");
    const fs = await import("fs");
    const path = await import("path");

    const provider = new apn.default.Provider({
      token: {
        key: fs.readFileSync(path.resolve(process.env.APNS_KEY_PATH!)),
        keyId: process.env.APNS_KEY_ID!,
        teamId: process.env.APPLE_TEAM_ID!,
      },
      production: process.env.NODE_ENV === "production",
    });

    const notification = new apn.default.Notification();
    notification.topic = params.topic;
    notification.alert = { title: params.title, body: params.body };
    notification.sound = "default";

    const result = await provider.send(notification, params.deviceToken);
    provider.shutdown();

    return result.failed.length === 0;
  } catch (err) {
    console.error("[APNS] Error sending notification:", err);
    return false;
  }
}
