import { FastifyInstance } from "fastify";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import {
  createOrUpdateLoyaltyClass,
  createLoyaltyObject,
  updateLoyaltyObject,
  generateGoogleWalletJwt,
  buildGoogleWalletLink,
  isGoogleWalletConfigured,
} from "../services/googleWallet";
import { generatePass, generateAuthToken, isAppleConfigured } from "../services/passkit";

const enrollSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  deviceType: z.enum(["APPLE", "GOOGLE"]),
});

const checkinSchema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().min(1).max(100).optional(),
  deviceType: z.enum(["APPLE", "GOOGLE", "NONE"]).default("NONE"),
});

export async function tapRoutes(app: FastifyInstance) {
  // Rate limit tap endpoints: 10 requests per minute per IP
  const rateLimitConfig = {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
      },
    },
  };

  // GET /tap/:slug — returns business info for the tap landing page
  app.get("/:slug", rateLimitConfig, async (req, reply) => {
    const { slug } = req.params as { slug: string };

    const business = await prisma.business.findUnique({
      where: { slug, isActive: true },
      include: { loyaltyProgram: true },
    });

    if (!business) {
      return reply.code(404).send({ error: "Business not found" });
    }

    return reply.send({
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        logoUrl: business.logoUrl,
        brandColor: business.brandColor,
      },
      loyaltyProgram: business.loyaltyProgram
        ? {
            cardType: business.loyaltyProgram.cardType,
            goalValue: business.loyaltyProgram.goalValue,
            rewardDescription: business.loyaltyProgram.rewardDescription,
            backgroundColor: business.loyaltyProgram.backgroundColor,
            foregroundColor: business.loyaltyProgram.foregroundColor,
            labelColor: business.loyaltyProgram.labelColor,
          }
        : null,
      capabilities: {
        appleWallet: isAppleConfigured(),
        googleWallet: isGoogleWalletConfigured(),
      },
    });
  });

  // POST /tap/:slug/enroll — creates client and returns pass link
  app.post("/:slug/enroll", rateLimitConfig, async (req, reply) => {
    const { slug } = req.params as { slug: string };

    const body = enrollSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });
    }

    const business = await prisma.business.findUnique({
      where: { slug, isActive: true },
      include: { loyaltyProgram: true },
    });

    if (!business || !business.loyaltyProgram) {
      return reply.code(404).send({ error: "Business not found" });
    }

    const { name, phone, deviceType } = body.data;
    const program = business.loyaltyProgram;

    // Check if client with same phone already enrolled (prevent duplicates)
    if (phone) {
      const existing = await prisma.client.findFirst({
        where: { businessId: business.id, phone },
      });
      if (existing) {
        return reply.code(409).send({
          error: "Already enrolled",
          clientId: existing.id,
          message: "This phone number is already registered for this business.",
        });
      }
    }

    const clientId = uuidv4();
    const applePassSerial = uuidv4();
    const appleAuthToken = generateAuthToken();
    let googlePassObjectId: string | null = null;
    let googleWalletLink: string | null = null;
    let applePassUrl: string | null = null;

    // Create Google Wallet pass if Google is configured and device is Android
    if (deviceType === "GOOGLE" && isGoogleWalletConfigured()) {
      try {
        await createOrUpdateLoyaltyClass({
          businessSlug: business.slug,
          businessName: business.name,
          rewardDescription: program.rewardDescription,
          logoUrl: business.logoUrl ?? undefined,
          backgroundColor: program.backgroundColor,
        });

        googlePassObjectId = await createLoyaltyObject({
          businessSlug: business.slug,
          businessName: business.name,
          clientId,
          clientName: name,
          stampsCount: 0,
          goalValue: program.goalValue,
          rewardDescription: program.rewardDescription,
          enrolledAt: new Date(),
        });

        const jwtToken = generateGoogleWalletJwt({
          businessSlug: business.slug,
          clientId,
        });
        googleWalletLink = buildGoogleWalletLink(jwtToken);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[Tap] Google Wallet error:", msg);
        // Surface error in dev — remove in production
        if (process.env.NODE_ENV !== "production") {
          return reply.code(500).send({ error: "Google Wallet setup failed", detail: msg });
        }
        // In production: don't fail enrollment, client still gets created below
      }
    }

    // Generate Apple pass if Apple is configured and device is iOS
    if (deviceType === "APPLE" && isAppleConfigured()) {
      const passBuffer = await generatePass({
        serialNumber: applePassSerial,
        authToken: appleAuthToken,
        businessName: business.name,
        clientName: name,
        stampsCount: 0,
        goalValue: program.goalValue,
        rewardDescription: program.rewardDescription,
        backgroundColor: program.backgroundColor,
        foregroundColor: program.foregroundColor,
        labelColor: program.labelColor,
      });

      if (passBuffer) {
        applePassUrl = `${process.env.BASE_URL}/passes/download/${clientId}`;
      }
    }

    // Save client to DB
    const client = await prisma.client.create({
      data: {
        id: clientId,
        businessId: business.id,
        name,
        phone: phone ?? null,
        deviceType,
        applePassSerial,
        appleAuthToken,
        googlePassObjectId,
        stampsCount: 0,
        lastVisitAt: new Date(),
        enrolledAt: new Date(),
      },
    });

    // Record initial visit
    await prisma.visit.create({
      data: {
        clientId: client.id,
        businessId: business.id,
        stampsAdded: 0,
      },
    });

    const response: Record<string, unknown> = {
      clientId: client.id,
      message: "Enrollment successful",
      deviceType,
    };

    if (googleWalletLink) response.googleWalletLink = googleWalletLink;
    if (applePassUrl) response.applePassUrl = applePassUrl;

    if (!googleWalletLink && !applePassUrl) {
      response.message =
        "Enrolled! Ask the business to stamp your card on your next visit.";
    }

    return reply.code(201).send(response);
  });

  // GET /tap/:slug/client — look up existing client by phone (for returning visitors)
  app.get("/:slug/client", rateLimitConfig, async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const { phone } = req.query as { phone?: string };

    if (!phone) return reply.code(400).send({ error: "phone query param required" });

    const business = await prisma.business.findUnique({ where: { slug } });
    if (!business) return reply.code(404).send({ error: "Not found" });

    const client = await prisma.client.findFirst({
      where: { businessId: business.id, phone },
      select: { id: true, name: true, stampsCount: true, lastVisitAt: true, deviceType: true },
    });

    if (!client) return reply.code(404).send({ error: "Client not found" });
    return reply.send(client);
  });

  // POST /tap/:slug/checkin — automatic stamp on QR/NFC scan
  // Phone is required (used as customer identifier).
  // Returns status: "stamped" | "enrolled" | "needs_name" | "already_stamped" | "reward_ready"
  app.post("/:slug/checkin", rateLimitConfig, async (req, reply) => {
    const { slug } = req.params as { slug: string };

    const body = checkinSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid input" });
    const { phone, name, deviceType } = body.data;

    const business = await prisma.business.findUnique({
      where: { slug, isActive: true },
      include: { loyaltyProgram: true },
    });
    if (!business || !business.loyaltyProgram) {
      return reply.code(404).send({ error: "Business not found" });
    }
    const program = business.loyaltyProgram;

    // --- Returning customer ---
    const existing = await prisma.client.findFirst({
      where: { businessId: business.id, phone },
    });

    if (existing) {
      // 4-hour cooldown prevents scanning multiple times in one visit
      const COOLDOWN_MS = 4 * 60 * 60 * 1000;
      if (existing.lastVisitAt && Date.now() - existing.lastVisitAt.getTime() < COOLDOWN_MS) {
        const nextAt = new Date(existing.lastVisitAt.getTime() + COOLDOWN_MS);
        return reply.send({
          status: "already_stamped",
          clientName: existing.name,
          stampsCount: existing.stampsCount,
          goalValue: program.goalValue,
          nextStampAt: nextAt.toISOString(),
        });
      }

      const newCount = existing.stampsCount + 1;
      await prisma.client.update({
        where: { id: existing.id },
        data: { stampsCount: newCount, lastVisitAt: new Date() },
      });
      await prisma.visit.create({
        data: { clientId: existing.id, businessId: business.id, stampsAdded: 1 },
      });

      // Update Google Wallet card in real time
      if (existing.googlePassObjectId) {
        try {
          await updateLoyaltyObject({
            objectId: existing.googlePassObjectId,
            stampsCount: newCount,
            goalValue: program.goalValue,
            rewardDescription: program.rewardDescription,
            clientName: existing.name,
          });
        } catch (err) {
          console.error("[Checkin] Google Wallet update failed:", err instanceof Error ? err.message : err);
        }
      }

      const rewardReady = newCount >= program.goalValue;
      return reply.send({
        status: rewardReady ? "reward_ready" : "stamped",
        clientName: existing.name,
        stampsCount: newCount,
        goalValue: program.goalValue,
        rewardDescription: program.rewardDescription,
      });
    }

    // --- New customer — need name first ---
    if (!name) {
      return reply.send({ status: "needs_name" });
    }

    // Enroll with first stamp already applied
    const clientId = uuidv4();
    const applePassSerial = uuidv4();
    const appleAuthToken = generateAuthToken();
    let googlePassObjectId: string | null = null;
    let googleWalletLink: string | null = null;
    let applePassUrl: string | null = null;

    if (deviceType === "GOOGLE" && isGoogleWalletConfigured()) {
      try {
        await createOrUpdateLoyaltyClass({
          businessSlug: business.slug,
          businessName: business.name,
          rewardDescription: program.rewardDescription,
          logoUrl: business.logoUrl ?? undefined,
          backgroundColor: program.backgroundColor,
        });
        googlePassObjectId = await createLoyaltyObject({
          businessSlug: business.slug,
          businessName: business.name,
          clientId,
          clientName: name,
          stampsCount: 1,
          goalValue: program.goalValue,
          rewardDescription: program.rewardDescription,
          enrolledAt: new Date(),
        });
        const jwtToken = generateGoogleWalletJwt({ businessSlug: business.slug, clientId });
        googleWalletLink = buildGoogleWalletLink(jwtToken);
      } catch (err) {
        console.error("[Checkin] Google Wallet setup failed:", err instanceof Error ? err.message : err);
      }
    }

    if (deviceType === "APPLE" && isAppleConfigured()) {
      const passBuffer = await generatePass({
        serialNumber: applePassSerial,
        authToken: appleAuthToken,
        businessName: business.name,
        clientName: name,
        stampsCount: 1,
        goalValue: program.goalValue,
        rewardDescription: program.rewardDescription,
        backgroundColor: program.backgroundColor,
        foregroundColor: program.foregroundColor ?? "#ffffff",
        labelColor: program.labelColor ?? "#ffffff",
      });
      if (passBuffer) {
        applePassUrl = `${process.env.BASE_URL}/passes/download/${clientId}`;
      }
    }

    const client = await prisma.client.create({
      data: {
        id: clientId,
        businessId: business.id,
        name,
        phone,
        deviceType: deviceType === "NONE" ? null : deviceType,
        applePassSerial,
        appleAuthToken,
        googlePassObjectId,
        stampsCount: 1,
        lastVisitAt: new Date(),
        enrolledAt: new Date(),
      },
    });
    await prisma.visit.create({
      data: { clientId: client.id, businessId: business.id, stampsAdded: 1 },
    });

    return reply.code(201).send({
      status: "enrolled",
      clientId: client.id,
      clientName: name,
      stampsCount: 1,
      goalValue: program.goalValue,
      rewardDescription: program.rewardDescription,
      googleWalletLink,
      applePassUrl,
    });
  });
}
