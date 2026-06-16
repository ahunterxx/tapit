import { FastifyInstance } from "fastify";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma";
import {
  createOrUpdateLoyaltyClass,
  createLoyaltyObject,
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
}
