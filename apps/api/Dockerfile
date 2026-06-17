FROM node:20-alpine AS base
WORKDIR /app

# Install deps at root (npm workspaces)
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
RUN npm ci --workspace=apps/api --include-workspace-root

# Copy source
COPY apps/api ./apps/api

# Generate Prisma client
RUN npx prisma generate --schema=./apps/api/prisma/schema.prisma

# Build TypeScript
RUN npm run build --workspace=apps/api

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/prisma ./apps/api/prisma
COPY --from=base /app/apps/api/package.json ./apps/api/package.json
COPY --from=base /app/package.json ./package.json

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
