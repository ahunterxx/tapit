import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";

import { authRoutes } from "./routes/auth";
import { adminRoutes } from "./routes/admin";
import { tapRoutes } from "./routes/tap";
import { passesRoutes } from "./routes/passes";
import { clientsRoutes } from "./routes/dashboard/clients";
import { notificationsRoutes } from "./routes/dashboard/notifications";
import { programRoutes } from "./routes/dashboard/program";
import { campaignsRoutes } from "./routes/dashboard/campaigns";
import { overviewRoutes } from "./routes/dashboard/overview";
import { internalRoutes } from "./routes/internal";
import { startCampaignWorker } from "./jobs/worker";

const app = Fastify({ logger: true });

async function start() {
  const allowedOrigins = [
    process.env.WEB_URL ?? "http://localhost:3000",
    "http://localhost:3000",
    "http://localhost:3001",
  ].filter(Boolean);

  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
        cb(null, true);
      } else {
        cb(new Error(`CORS: origin ${origin} not allowed`), false);
      }
    },
    credentials: true,
  });

  await app.register(cookie, {
    secret: process.env.JWT_SECRET ?? "fallback-secret",
  });

  await app.register(rateLimit, {
    global: false,
  });

  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(tapRoutes, { prefix: "/tap" });
  await app.register(passesRoutes, { prefix: "/passes" });
  await app.register(overviewRoutes, { prefix: "/dashboard" });
  await app.register(clientsRoutes, { prefix: "/dashboard/clients" });
  await app.register(notificationsRoutes, { prefix: "/dashboard/notifications" });
  await app.register(programRoutes, { prefix: "/dashboard/program" });
  await app.register(campaignsRoutes, { prefix: "/dashboard/campaigns" });
  await app.register(internalRoutes, { prefix: "/internal" });

  startCampaignWorker();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen({ port, host: "0.0.0.0" });
  console.log(`API running on http://localhost:${port}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
