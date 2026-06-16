/**
 * Apple PassKit web service endpoints.
 * Required by Apple Wallet to register devices and push pass updates.
 * These are no-ops when Apple is not configured but must exist for the protocol.
 */

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { generatePass } from "../services/passkit";

export async function passesRoutes(app: FastifyInstance) {
  // Apple calls this when a user adds the pass to their Wallet
  app.post(
    "/v1/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber",
    async (req, reply) => {
      const { deviceLibraryId, passTypeId, serialNumber } =
        req.params as Record<string, string>;

      const authHeader = req.headers.authorization;
      const authToken = authHeader?.replace("ApplePass ", "").trim();

      if (!authToken) return reply.code(401).send();

      const client = await prisma.client.findFirst({
        where: { applePassSerial: serialNumber, appleAuthToken: authToken },
      });

      if (!client) return reply.code(401).send();

      const { pushToken } = req.body as { pushToken: string };

      // Upsert device registration
      await prisma.deviceRegistration.upsert({
        where: {
          deviceLibraryId_passTypeId_serialNumber: {
            deviceLibraryId,
            passTypeId,
            serialNumber,
          },
        },
        update: { pushToken },
        create: {
          deviceLibraryId,
          pushToken,
          passTypeId,
          serialNumber,
          clientId: client.id,
        },
      });

      // Save push token to client for future pushes
      await prisma.client.update({
        where: { id: client.id },
        data: { appleDeviceToken: pushToken },
      });

      return reply.code(201).send();
    }
  );

  // Apple calls this when user removes the pass
  app.delete(
    "/v1/devices/:deviceLibraryId/registrations/:passTypeId/:serialNumber",
    async (req, reply) => {
      const { deviceLibraryId, passTypeId, serialNumber } =
        req.params as Record<string, string>;

      await prisma.deviceRegistration.deleteMany({
        where: { deviceLibraryId, passTypeId, serialNumber },
      });

      return reply.code(200).send();
    }
  );

  // Apple asks: which passes have been updated since a given date?
  app.get(
    "/v1/devices/:deviceLibraryId/registrations/:passTypeId",
    async (req, reply) => {
      const { deviceLibraryId, passTypeId } = req.params as Record<string, string>;
      const { passesUpdatedSince } = req.query as { passesUpdatedSince?: string };

      const registrations = await prisma.deviceRegistration.findMany({
        where: { deviceLibraryId, passTypeId },
        include: {
          client: {
            select: { applePassSerial: true, lastVisitAt: true },
          },
        },
      });

      const since = passesUpdatedSince ? new Date(passesUpdatedSince) : new Date(0);
      const updated = registrations
        .filter(
          (r) =>
            r.client.lastVisitAt && r.client.lastVisitAt > since
        )
        .map((r) => r.client.applePassSerial)
        .filter(Boolean) as string[];

      if (updated.length === 0) return reply.code(204).send();

      return reply.send({
        serialNumbers: updated,
        lastUpdated: new Date().toISOString(),
      });
    }
  );

  // Apple fetches the latest .pkpass file for a serial number
  app.get("/v1/passes/:passTypeId/:serialNumber", async (req, reply) => {
    const { serialNumber } = req.params as Record<string, string>;

    const authHeader = req.headers.authorization;
    const authToken = authHeader?.replace("ApplePass ", "").trim();

    const client = await prisma.client.findFirst({
      where: { applePassSerial: serialNumber },
      include: { business: { include: { loyaltyProgram: true } } },
    });

    if (!client || !client.business.loyaltyProgram) return reply.code(404).send();
    if (client.appleAuthToken !== authToken) return reply.code(401).send();

    const program = client.business.loyaltyProgram;

    const passBuffer = await generatePass({
      serialNumber: client.applePassSerial!,
      authToken: client.appleAuthToken!,
      businessName: client.business.name,
      clientName: client.name,
      stampsCount: client.stampsCount,
      goalValue: program.goalValue,
      rewardDescription: program.rewardDescription,
      backgroundColor: program.backgroundColor,
      foregroundColor: program.foregroundColor,
      labelColor: program.labelColor,
    });

    if (!passBuffer) return reply.code(503).send({ error: "Apple Wallet not configured" });

    return reply
      .header("Content-Type", "application/vnd.apple.pkpass")
      .header("Last-Modified", client.lastVisitAt?.toUTCString() ?? new Date().toUTCString())
      .send(passBuffer);
  });

  // Apple logs pass errors here
  app.post("/v1/log", async (req, reply) => {
    const { logs } = req.body as { logs: string[] };
    if (logs?.length) {
      console.error("[Apple PassKit Logs]", logs);
    }
    return reply.code(200).send();
  });

  // Client-facing: download .pkpass by clientId
  app.get("/download/:clientId", async (req, reply) => {
    const { clientId } = req.params as { clientId: string };

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { business: { include: { loyaltyProgram: true } } },
    });

    if (!client || !client.business.loyaltyProgram) {
      return reply.code(404).send({ error: "Not found" });
    }

    const program = client.business.loyaltyProgram;
    const passBuffer = await generatePass({
      serialNumber: client.applePassSerial!,
      authToken: client.appleAuthToken!,
      businessName: client.business.name,
      clientName: client.name,
      stampsCount: client.stampsCount,
      goalValue: program.goalValue,
      rewardDescription: program.rewardDescription,
      backgroundColor: program.backgroundColor,
      foregroundColor: program.foregroundColor,
      labelColor: program.labelColor,
    });

    if (!passBuffer) {
      return reply.code(503).send({ error: "Apple Wallet not configured yet" });
    }

    return reply
      .header("Content-Type", "application/vnd.apple.pkpass")
      .header("Content-Disposition", `attachment; filename="loyalty.pkpass"`)
      .send(passBuffer);
  });
}
