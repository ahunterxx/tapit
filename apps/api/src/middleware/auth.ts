import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  businessId: string;
  email: string;
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token =
    req.cookies?.token ?? req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    (req as FastifyRequest & { business: JwtPayload }).business = payload;
  } catch {
    return reply.code(401).send({ error: "Invalid token" });
  }
}

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const secret = req.headers["x-admin-secret"];
  if (secret !== process.env.ADMIN_SECRET) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
}

export function getBusinessFromReq(req: FastifyRequest): JwtPayload {
  return (req as FastifyRequest & { business: JwtPayload }).business;
}
