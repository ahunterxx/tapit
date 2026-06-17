import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { getCampaignQueue, CampaignJobData } from "../jobs/worker";

function requireAdminSecret(req: { headers: Record<string, string | string[] | undefined> }, reply: { code: (n: number) => { send: (b: unknown) => void } }) {
  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    reply.code(401).send({ error: "Unauthorized" });
    return false;
  }
  return true;
}

export async function internalRoutes(app: FastifyInstance) {
  // Called every hour by Railway/Vercel cron
  app.post("/jobs/run-campaigns", async (req, reply) => {
    if (!requireAdminSecret(req as never, reply as never)) return;

    const activeCampaigns = await prisma.campaign.findMany({
      where: { isActive: true },
      select: { id: true, businessId: true, type: true },
    });

    if (activeCampaigns.length === 0) {
      return reply.send({ queued: 0, message: "No active campaigns" });
    }

    const queue = getCampaignQueue();
    const jobs = activeCampaigns
      .filter((c) => c.type !== "CUSTOM")
      .map((c) => ({
        name: c.type,
        data: {
          type: c.type as CampaignJobData["type"],
          businessId: c.businessId,
          campaignId: c.id,
        },
      }));

    await queue.addBulk(jobs);
    await queue.close();

    console.log(`[Internal] Queued ${jobs.length} campaign jobs`);
    return reply.send({ queued: jobs.length, campaigns: jobs.map((j) => j.name) });
  });

  // Health check for cron services
  app.get("/health", async (req, reply) => {
    if (!requireAdminSecret(req as never, reply as never)) return;
    return reply.send({ ok: true, ts: new Date().toISOString() });
  });
}
