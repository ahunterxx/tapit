import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma";
import { requireAuth, getBusinessFromReq } from "../../middleware/auth";

export async function overviewRoutes(app: FastifyInstance) {
  app.get("/overview", { preHandler: [requireAuth] }, async (req, reply) => {
    const { businessId } = getBusinessFromReq(req);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalClients,
      activeThisMonth,
      stampsToday,
      totalVisits,
      recentActivity,
      atRiskCount,
    ] = await Promise.all([
      prisma.client.count({ where: { businessId } }),

      prisma.client.count({
        where: { businessId, lastVisitAt: { gte: startOfMonth } },
      }),

      prisma.visit.aggregate({
        where: { businessId, timestamp: { gte: startOfDay } },
        _sum: { stampsAdded: true },
      }),

      prisma.visit.count({ where: { businessId } }),

      prisma.visit.findMany({
        where: { businessId },
        orderBy: { timestamp: "desc" },
        take: 10,
        include: {
          client: { select: { name: true, phone: true } },
        },
      }),

      prisma.client.count({
        where: {
          businessId,
          lastVisitAt: { lt: thirtyDaysAgo, not: null },
        },
      }),
    ]);

    const program = await prisma.loyaltyProgram.findUnique({
      where: { businessId },
    });

    const redemptions = program
      ? await prisma.client.count({
          where: { businessId, stampsCount: { gte: program.goalValue } },
        })
      : 0;

    return reply.send({
      stats: {
        totalClients,
        activeThisMonth,
        stampsToday: stampsToday._sum.stampsAdded ?? 0,
        totalVisits,
        redemptions,
        atRisk: atRiskCount,
      },
      recentActivity: recentActivity.map((v) => ({
        id: v.id,
        clientName: v.client.name,
        clientPhone: v.client.phone,
        stampsAdded: v.stampsAdded,
        timestamp: v.timestamp,
      })),
    });
  });
}
