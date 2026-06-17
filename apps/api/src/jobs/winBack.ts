import { prisma } from "../lib/prisma";
import { sendClientNotification } from "./worker";

export async function runWinBack(params: { businessId: string; campaignId: string }) {
  const { businessId, campaignId } = params;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !campaign.isActive || campaign.type !== "WIN_BACK") return;

  const triggerDays = campaign.triggerDays ?? 30;
  const cutoff = new Date(Date.now() - triggerDays * 24 * 60 * 60 * 1000);
  // Don't re-notify same client within the trigger window
  const dedupCutoff = new Date(Date.now() - triggerDays * 24 * 60 * 60 * 1000);

  const dormantClients = await prisma.client.findMany({
    where: {
      businessId,
      lastVisitAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (dormantClients.length === 0) {
    console.log(`[WinBack] No dormant clients for business ${businessId}`);
    return;
  }

  let notified = 0;

  for (const { id: clientId } of dormantClients) {
    // Skip if already notified recently
    const recent = await prisma.notification.findFirst({
      where: {
        businessId,
        targetClientId: clientId,
        targetType: "INDIVIDUAL",
        sentAt: { gte: dedupCutoff },
      },
    });
    if (recent) continue;

    const sent = await sendClientNotification({
      clientId,
      businessId,
      title: "We miss you!",
      message: campaign.message,
    });

    if (sent) notified++;
  }

  console.log(`[WinBack] Notified ${notified}/${dormantClients.length} dormant clients for business ${businessId}`);
}
