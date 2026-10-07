FROM node:20-alpine AS base
WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install deps
RUN npm install --workspace=@promotions/shared --workspace=@promotions/web

# Copy source
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY tsconfig.base.json ./

# Build shared types
RUN npm run build --workspace=@promotions/shared

# Build Next.js
RUN npm run build --workspace=@promotions/web

EXPOSE 3001
CMD ["npm", "run", "start", "--workspace=@promotions/web"]
