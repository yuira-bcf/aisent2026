# ---- Stage 1: Install dependencies ----
FROM node:22-alpine AS deps
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json turbo.json ./

# Copy workspace package.json files needed for install
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json

# Install all dependencies (uses npm workspaces)
RUN npm ci

# ---- Stage 2: Build the application ----
FROM node:22-alpine AS builder
WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules

# Copy root workspace config
COPY package.json package-lock.json turbo.json ./

# Copy source code for packages/db (build dependency)
COPY packages/db packages/db

# Copy source code for apps/web
COPY apps/web apps/web

# Build the Next.js app via workspace script
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w apps/web

# ---- Stage 3: Production runner ----
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
# Copy static assets
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
# Copy public assets (if any)
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

CMD ["node", "apps/web/server.js"]
