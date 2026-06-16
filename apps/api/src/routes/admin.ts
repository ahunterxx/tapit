import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAdmin } from "../middleware/auth";
import { generateQRCodeBuffer } from "../services/qrcode";
import { uploadFile } from "../services/storage";

const createBusinessSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens"),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8),
  brandColor: z.string().default("#000000"),
  goalValue: z.number().int().min(1).default(10),
  rewardDescription: z.string().default("Free reward"),
});

export async function adminRoutes(app: FastifyInstance) {
  app.post(
    "/businesses",
    { preHandler: [requireAdmin] },
    async (req, reply) => {
      const body = createBusinessSchema.safeParse(req.body);
      if (!body.success) {
        return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });
      }

      const { name, slug, ownerEmail, ownerPassword, brandColor, goalValue, rewardDescription } =
        body.data;

      const exists = await prisma.business.findFirst({
        where: { OR: [{ slug }, { ownerEmail }] },
      });
      if (exists) {
        return reply.code(409).send({ error: "Slug or email already in use" });
      }

      const ownerPasswordHash = await bcrypt.hash(ownerPassword, 12);
      const tapUrl = `${process.env.WEB_URL ?? "http://localhost:3000"}/tap/${slug}`;

      const qrBuffer = await generateQRCodeBuffer(tapUrl);
      const qrUrl = await uploadFile("qrcodes", `${slug}/qr.png`, qrBuffer, "image/png");

      const business = await prisma.business.create({
        data: {
          name,
          slug,
          ownerEmail,
          ownerPasswordHash,
          brandColor,
          qrCodeUrl: qrUrl,
          loyaltyProgram: {
            create: {
              goalValue,
              rewardDescription,
              backgroundColor: brandColor,
            },
          },
          campaigns: {
            createMany: {
              data: [
                { type: "WIN_BACK", triggerDays: 30, isActive: false, message: `Hey! We miss you at ${name}. Come back and earn your next stamp!` },
                { type: "WIN_BACK", triggerDays: 60, isActive: false, message: `It's been a while, ${name} misses you! Come visit us again.` },
                { type: "REWARD_READY", isActive: true, message: `You're just 1 stamp away from your reward at ${name}! Come on in.` },
                { type: "BIRTHDAY", isActive: false, message: `Happy Birthday! 🎉 Celebrate with a free visit at ${name}.` },
              ],
            },
          },
        },
        include: { loyaltyProgram: true },
      });

      return reply.code(201).send({
        business: {
          id: business.id,
          name: business.name,
          slug: business.slug,
          tapUrl,
          qrCodeUrl: business.qrCodeUrl,
          ownerEmail: business.ownerEmail,
        },
        loyaltyProgram: business.loyaltyProgram,
      });
    }
  );

  app.get("/businesses", { preHandler: [requireAdmin] }, async (req, reply) => {
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        ownerEmail: true,
        isActive: true,
        createdAt: true,
        _count: { select: { clients: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reply.send(businesses);
  });

  app.patch(
    "/businesses/:id/toggle",
    { preHandler: [requireAdmin] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const business = await prisma.business.findUnique({ where: { id } });
      if (!business) return reply.code(404).send({ error: "Not found" });

      const updated = await prisma.business.update({
        where: { id },
        data: { isActive: !business.isActive },
      });
      return reply.send({ isActive: updated.isActive });
    }
  );
}
