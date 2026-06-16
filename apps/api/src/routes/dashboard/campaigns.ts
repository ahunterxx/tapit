import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, getBusinessFromReq } from "../../middleware/auth";

const updateCampaignSchema = z.object({
  isActive: z.boolean().optional(),
  message: z.string().min(1).max(500).optional(),
  triggerDays: z.number().int().min(1).optional(),
});

export async function campaignsRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);
    const campaigns = await prisma.campaign.findMany({
      where: { businessId },
      orderBy: { createdAt: "asc" },
    });
    return reply.send(campaigns);
  });

  app.put("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);
    const { id } = req.params as { id: string };

    const body = updateCampaignSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });
    }

    const campaign = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found" });

    const updated = await prisma.campaign.update({ where: { id }, data: body.data });
    return reply.send(updated);
  });

  app.patch("/:id/toggle", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);
    const { id } = req.params as { id: string };

    const campaign = await prisma.campaign.findFirst({ where: { id, businessId } });
    if (!campaign) return reply.code(404).send({ error: "Campaign not found" });

    const updated = await prisma.campaign.update({
      where: { id },
      data: { isActive: !campaign.isActive },
    });
    return reply.send({ isActive: updated.isActive });
  });
}
