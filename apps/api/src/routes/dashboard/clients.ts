import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../lib/prisma";
import { requireAuth, getBusinessFromReq } from "../../middleware/auth";
import { sendSilentPassUpdate } from "../../services/apns";
import { updateLoyaltyObject, isGoogleWalletConfigured } from "../../services/googleWallet";
import { generatePass } from "../../services/passkit";

export async function clientsRoutes(app: FastifyInstance) {
  // List clients with pagination + search
  app.get("/", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);
    const { search, status, page = "1", limit = "20" } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, parseInt(limit));
    const skip = (pageNum - 1) * limitNum;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = { businessId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
      ];
    }

    if (status === "active") {
      where.lastVisitAt = { gte: thirtyDaysAgo };
    } else if (status === "at-risk") {
      where.lastVisitAt = { lt: thirtyDaysAgo, gte: sixtyDaysAgo };
    } else if (status === "dormant") {
      where.lastVisitAt = { lt: sixtyDaysAgo };
    }

    const [clients, total] = await Promise.all([
      prisma.client.findMany({
        where,
        orderBy: { lastVisitAt: "desc" },
        skip,
        take: limitNum,
        select: {
          id: true,
          name: true,
          phone: true,
          stampsCount: true,
          deviceType: true,
          lastVisitAt: true,
          enrolledAt: true,
          _count: { select: { visits: true } },
        },
      }),
      prisma.client.count({ where }),
    ]);

    const program = await prisma.loyaltyProgram.findUnique({ where: { businessId } });

    return reply.send({
      clients: clients.map((c) => ({
        ...c,
        visitCount: c._count.visits,
        status:
          !c.lastVisitAt
            ? "new"
            : c.lastVisitAt >= thirtyDaysAgo
            ? "active"
            : c.lastVisitAt >= sixtyDaysAgo
            ? "at-risk"
            : "dormant",
        goalValue: program?.goalValue ?? 10,
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  });

  // Get single client
  app.get("/:id", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);
    const { id } = req.params as { id: string };

    const client = await prisma.client.findFirst({
      where: { id, businessId },
      include: {
        visits: { orderBy: { timestamp: "desc" }, take: 50 },
        business: { include: { loyaltyProgram: true } },
      },
    });

    if (!client) return reply.code(404).send({ error: "Client not found" });

    return reply.send(client);
  });

  // Add a stamp — the core barber action
  app.post("/:id/stamp", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);
    const { id } = req.params as { id: string };
    const { count = 1 } = (req.body as { count?: number }) ?? {};

    const client = await prisma.client.findFirst({
      where: { id, businessId },
      include: { business: { include: { loyaltyProgram: true } } },
    });

    if (!client) return reply.code(404).send({ error: "Client not found" });

    const program = client.business.loyaltyProgram;
    if (!program) return reply.code(400).send({ error: "No loyalty program configured" });

    const newStampCount = client.stampsCount + count;
    const reachedGoal = newStampCount >= program.goalValue && client.stampsCount < program.goalValue;

    // Update client in DB
    const updated = await prisma.client.update({
      where: { id },
      data: {
        stampsCount: newStampCount,
        lastVisitAt: new Date(),
      },
    });

    // Record visit
    await prisma.visit.create({
      data: {
        clientId: id,
        businessId,
        stampsAdded: count,
      },
    });

    // Push updates — fire and forget (don't block response)
    if (client.deviceType === "APPLE" && client.appleDeviceToken) {
      sendSilentPassUpdate(client.appleDeviceToken).catch(console.error);
    }

    if (client.deviceType === "GOOGLE" && client.googlePassObjectId && isGoogleWalletConfigured()) {
      updateLoyaltyObject({
        objectId: client.googlePassObjectId,
        stampsCount: newStampCount,
        goalValue: program.goalValue,
        rewardDescription: program.rewardDescription,
        clientName: client.name,
      }).catch(console.error);
    }

    // Send reward notification when goal is reached
    if (reachedGoal) {
      const notifTitle = `🎉 Your ${program.rewardDescription} is ready!`;
      const notifBody = `Congratulations! You've earned your reward at ${client.business.name}. Show this to redeem.`;

      await prisma.notification.create({
        data: {
          businessId,
          title: notifTitle,
          message: notifBody,
          targetType: "INDIVIDUAL",
          targetClientId: id,
          sentCount: 1,
        },
      });

      if (client.deviceType === "APPLE" && client.appleDeviceToken) {
        sendSilentPassUpdate(client.appleDeviceToken).catch(console.error);
      }
    }

    return reply.send({
      stampsCount: updated.stampsCount,
      reachedGoal,
      goalValue: program.goalValue,
      message: reachedGoal
        ? `🎉 ${client.name} has earned their reward!`
        : `Stamp added! ${updated.stampsCount}/${program.goalValue} stamps.`,
    });
  });

  // Reset stamps after reward redemption
  app.post("/:id/redeem", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);
    const { id } = req.params as { id: string };

    const client = await prisma.client.findFirst({
      where: { id, businessId },
      include: { business: { include: { loyaltyProgram: true } } },
    });

    if (!client) return reply.code(404).send({ error: "Client not found" });

    const program = client.business.loyaltyProgram;
    if (!program) return reply.code(400).send({ error: "No program configured" });

    if (client.stampsCount < program.goalValue) {
      return reply.code(400).send({ error: "Client has not reached the reward goal yet" });
    }

    await prisma.client.update({
      where: { id },
      data: { stampsCount: 0 },
    });

    if (client.deviceType === "APPLE" && client.appleDeviceToken) {
      sendSilentPassUpdate(client.appleDeviceToken).catch(console.error);
    }

    if (client.deviceType === "GOOGLE" && client.googlePassObjectId && isGoogleWalletConfigured()) {
      updateLoyaltyObject({
        objectId: client.googlePassObjectId,
        stampsCount: 0,
        goalValue: program.goalValue,
        rewardDescription: program.rewardDescription,
        clientName: client.name,
      }).catch(console.error);
    }

    return reply.send({ message: "Reward redeemed. Stamps reset to 0." });
  });

  // Send push notification to a specific client
  app.post("/:id/notify", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);
    const { id } = req.params as { id: string };

    const { title, message } = req.body as { title: string; message: string };
    if (!title || !message) {
      return reply.code(400).send({ error: "title and message are required" });
    }

    const client = await prisma.client.findFirst({ where: { id, businessId } });
    if (!client) return reply.code(404).send({ error: "Client not found" });

    let sent = false;

    if (client.deviceType === "APPLE" && client.appleDeviceToken) {
      sent = await sendSilentPassUpdate(client.appleDeviceToken);
    }

    // Google FCM notifications require an fcmToken stored on the client (Phase 3)
    // For now, Google Wallet stamp updates happen via direct API PATCH — no FCM needed

    await prisma.notification.create({
      data: {
        businessId,
        title,
        message,
        targetType: "INDIVIDUAL",
        targetClientId: id,
        sentCount: sent ? 1 : 0,
        status: sent ? "sent" : "pending",
      },
    });

    return reply.send({ sent, message: sent ? "Notification sent" : "Queued (push not configured)" });
  });
}
