import { prisma } from "../lib/prisma";
import { sendClientNotification } from "./worker";

export async function runBirthday(params: { businessId: string; campaignId: string }) {
  const { businessId, campaignId } = params;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !campaign.isActive || campaign.type !== "BIRTHDAY") return;

  const now = new Date();
  const todayMonth = now.getMonth() + 1; // 1-12
  const todayDay = now.getDate();

  // Don't re-notify within 300 days (once per year guard)
  const dedupCutoff = new Date(Date.now() - 300 * 24 * 60 * 60 * 1000);

  // Fetch all clients with a birthday and filter in memory (avoids DB-specific date functions)
  const clients = await prisma.client.findMany({
    where: { businessId, birthday: { not: null } },
    select: { id: true, name: true, birthday: true },
  });

  const birthdayClients = clients.filter((c) => {
    if (!c.birthday) return false;
    const d = new Date(c.birthday);
    return d.getMonth() + 1 === todayMonth && d.getDate() === todayDay;
  });

  if (birthdayClients.length === 0) {
    console.log(`[Birthday] No birthday clients today for business ${businessId}`);
    return;
  }

  let notified = 0;

  for (const client of birthdayClients) {
    const recent = await prisma.notification.findFirst({
      where: {
        businessId,
        targetClientId: client.id,
        targetType: "INDIVIDUAL",
        sentAt: { gte: dedupCutoff },
      },
    });
    if (recent) continue;

    const sent = await sendClientNotification({
      clientId: client.id,
      businessId,
      title: `Happy Birthday, ${client.name}! 🎂`,
      message: campaign.message,
    });

    if (sent) notified++;
  }

  console.log(`[Birthday] Notified ${notified}/${birthdayClients.length} birthday clients for business ${businessId}`);
}
