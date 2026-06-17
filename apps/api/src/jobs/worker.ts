import { Queue, Worker } from "bullmq";
import { getRedisUrl } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { sendSilentPassUpdate, sendPushNotification, isApnsConfigured } from "../services/apns";
import { sendFcmNotification, isFcmConfigured } from "../services/fcm";
import { runWinBack } from "./winBack";
import { runRewardReady } from "./rewardReady";
import { runBirthday } from "./birthday";

export const CAMPAIGN_QUEUE = "campaigns";

export interface CampaignJobData {
  type: "WIN_BACK" | "REWARD_READY" | "BIRTHDAY";
  businessId: string;
  campaignId: string;
}

export function getCampaignQueue(): Queue<CampaignJobData> {
  return new Queue(CAMPAIGN_QUEUE, { connection: { url: getRedisUrl(), maxRetriesPerRequest: null } as never });
}

export async function sendClientNotification(params: {
  clientId: string;
  businessId: string;
  title: string;
  message: string;
}): Promise<boolean> {
  const { clientId, businessId, title, message } = params;

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { deviceType: true, appleDeviceToken: true },
  });

  if (!client) return false;

  let sent = false;

  if (client.deviceType === "APPLE" && client.appleDeviceToken && isApnsConfigured()) {
    sent = await sendPushNotification({
      deviceToken: client.appleDeviceToken,
      title,
      body: message,
      topic: process.env.APNS_TOPIC!,
    });
    if (sent) {
      // Also trigger a silent pass refresh so the wallet card updates
      await sendSilentPassUpdate(client.appleDeviceToken);
    }
  } else if (client.deviceType === "GOOGLE" && client.appleDeviceToken && isFcmConfigured()) {
    sent = await sendFcmNotification({ fcmToken: client.appleDeviceToken, title, body: message });
  } else {
    console.log(`[CampaignWorker] Client ${clientId} has no push token — skipping delivery`);
    sent = true; // treat as "sent" so we still create the DB record and avoid re-queuing
  }

  if (sent) {
    await prisma.notification.create({
      data: {
        businessId,
        title,
        message,
        targetType: "INDIVIDUAL",
        targetClientId: clientId,
        sentCount: 1,
        status: "sent",
      },
    });
  }

  return sent;
}

export function startCampaignWorker() {
  const worker = new Worker<CampaignJobData>(
    CAMPAIGN_QUEUE,
    async (job) => {
      const { type, businessId, campaignId } = job.data;
      console.log(`[CampaignWorker] Processing ${type} for business ${businessId}`);

      switch (type) {
        case "WIN_BACK":
          await runWinBack({ businessId, campaignId });
          break;
        case "REWARD_READY":
          await runRewardReady({ businessId, campaignId });
          break;
        case "BIRTHDAY":
          await runBirthday({ businessId, campaignId });
          break;
        default:
          console.warn(`[CampaignWorker] Unknown job type: ${type}`);
      }
    },
    {
      connection: { url: getRedisUrl(), maxRetriesPerRequest: null } as never,
      concurrency: 3,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[CampaignWorker] Job ${job.id} (${job.data.type}) completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[CampaignWorker] Job ${job?.id} (${job?.data?.type}) failed:`, err.message);
  });

  console.log("[CampaignWorker] Started — listening for campaign jobs");
  return worker;
}
