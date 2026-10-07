FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN npm install --ignore-scripts

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build shared types
RUN npm run build --workspace=packages/shared

# Build Next.js — needs NEXT_PUBLIC env vars at build time if used in static rendering
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build --workspace=apps/web

# ── Runtime image ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm install --ignore-scripts --omit=dev

COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public 2>/dev/null || true
COPY --from=builder /app/apps/web/next.config.js ./apps/web/next.config.js

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
EXPOSE 3001
CMD ["npm", "run", "start", "--workspace=apps/web"]
