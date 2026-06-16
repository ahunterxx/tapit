import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, getBusinessFromReq } from "../../middleware/auth";
import { sendSilentPassUpdate } from "../../services/apns";
import { sendFcmNotification } from "../../services/fcm";

const sendSchema = z.object({
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(500),
  targetType: z.enum(["ALL", "INDIVIDUAL"]),
  targetClientId: z.string().optional(),
});

export async function notificationsRoutes(app: FastifyInstance) {
  // Send a push notification
  app.post("/send", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);

    const body = sendSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });
    }

    const { title, message, targetType, targetClientId } = body.data;

    let targets: { id: string; appleDeviceToken: string | null; deviceType: string | null }[] = [];

    if (targetType === "INDIVIDUAL") {
      if (!targetClientId) {
        return reply.code(400).send({ error: "targetClientId required for INDIVIDUAL target" });
      }
      const client = await prisma.client.findFirst({
        where: { id: targetClientId, businessId },
        select: { id: true, appleDeviceToken: true, deviceType: true },
      });
      if (!client) return reply.code(404).send({ error: "Client not found" });
      targets = [client];
    } else {
      targets = await prisma.client.findMany({
        where: { businessId, appleDeviceToken: { not: null } },
        select: { id: true, appleDeviceToken: true, deviceType: true },
      });
    }

    let sentCount = 0;
    const errors: string[] = [];

    await Promise.allSettled(
      targets.map(async (client) => {
        if (!client.appleDeviceToken) return;

        try {
          if (client.deviceType === "APPLE") {
            await sendSilentPassUpdate(client.appleDeviceToken);
          } else if (client.deviceType === "GOOGLE") {
            await sendFcmNotification({
              fcmToken: client.appleDeviceToken,
              title,
              body: message,
            });
          }
          sentCount++;
        } catch (err) {
          errors.push(`Failed for client ${client.id}: ${err}`);
        }
      })
    );

    await prisma.notification.create({
      data: {
        businessId,
        title,
        message,
        targetType,
        targetClientId: targetClientId ?? null,
        sentCount,
        status: "sent",
      },
    });

    return reply.send({
      sent: sentCount,
      total: targets.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  });

  // List sent notifications
  app.get("/", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);
    const { page = "1" } = req.query as { page?: string };
    const pageNum = Math.max(1, parseInt(page));

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where: { businessId },
        orderBy: { sentAt: "desc" },
        skip: (pageNum - 1) * 20,
        take: 20,
      }),
      prisma.notification.count({ where: { businessId } }),
    ]);

    return reply.send({ notifications, total, page: pageNum });
  });
}
