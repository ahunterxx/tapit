import { FastifyInstance } from "fastify";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function authRoutes(app: FastifyInstance) {
  app.post("/login", async (req, reply) => {
    const body = loginSchema.safeParse(req.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid input", issues: body.error.issues });
    }

    const business = await prisma.business.findUnique({
      where: { ownerEmail: body.data.email },
    });

    if (!business || !business.isActive) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(body.data.password, business.ownerPasswordHash);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { businessId: business.id, email: business.ownerEmail },
      process.env.JWT_SECRET!,
      { expiresIn: "30d" }
    );

    return reply
      .setCookie("token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      })
      .send({
        token,
        business: {
          id: business.id,
          name: business.name,
          slug: business.slug,
          email: business.ownerEmail,
        },
      });
  });

  app.post("/logout", async (req, reply) => {
    return reply.clearCookie("token", { path: "/" }).send({ ok: true });
  });

  app.get("/me", { preHandler: [require("../middleware/auth").requireAuth] }, async (req, reply) => {
    const { businessId } = require("../middleware/auth").getBusinessFromReq(req);
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, slug: true, ownerEmail: true, logoUrl: true, brandColor: true, qrCodeUrl: true },
    });
    if (!business) return reply.code(404).send({ error: "Not found" });
    return reply.send(business);
  });
}
