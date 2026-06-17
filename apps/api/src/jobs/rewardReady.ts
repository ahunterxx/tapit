import { prisma } from "../lib/prisma";
import { sendClientNotification } from "./worker";

export async function runRewardReady(params: { businessId: string; campaignId: string }) {
  const { businessId, campaignId } = params;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !campaign.isActive || campaign.type !== "REWARD_READY") return;

  const program = await prisma.loyaltyProgram.findFirst({ where: { businessId } });
  if (!program) return;

  const goal = program.goalValue;
  if (goal < 2) return; // Need at least 2 stamps for "1 away" to make sense

  // Don't re-notify the same client within 7 days
  const dedupCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const eligibleClients = await prisma.client.findMany({
    where: {
      businessId,
      stampsCount: goal - 1,
    },
    select: { id: true },
  });

  if (eligibleClients.length === 0) {
    console.log(`[RewardReady] No eligible clients for business ${businessId}`);
    return;
  }

  let notified = 0;

  for (const { id: clientId } of eligibleClients) {
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
      title: "You're almost there! 🎉",
      message: campaign.message,
    });

    if (sent) notified++;
  }

  console.log(`[RewardReady] Notified ${notified}/${eligibleClients.length} clients for business ${businessId}`);
}
