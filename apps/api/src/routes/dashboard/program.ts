import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, getBusinessFromReq } from "../../middleware/auth";

const updateProgramSchema = z.object({
  goalValue: z.number().int().min(1).max(100).optional(),
  rewardDescription: z.string().min(1).max(200).optional(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  foregroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  labelColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

const updateBusinessSchema = z.object({
  name: z.string().min(2).optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function programRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);

    const [business, program] = await Promise.all([
      prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, slug: true, logoUrl: true, brandColor: true, qrCodeUrl: true },
      }),
      prisma.loyaltyProgram.findUnique({ where: { businessId } }),
    ]);

    return reply.send({ business, program });
  });

  app.put("/", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);

    const body = updateProgramSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });
    }

    const program = await prisma.loyaltyProgram.update({
      where: { businessId },
      data: body.data,
    });

    return reply.send(program);
  });

  app.put("/business", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);

    const body = updateBusinessSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });
    }

    const business = await prisma.business.update({
      where: { id: businessId },
      data: body.data,
      select: { id: true, name: true, slug: true, brandColor: true },
    });

    return reply.send(business);
  });
}
