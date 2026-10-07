FROM node:20-alpine AS base
WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install all workspace deps
RUN npm install --workspace=@promotions/shared --workspace=@promotions/api

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY tsconfig.base.json ./

# Build shared first, then api
RUN npm run build --workspace=@promotions/shared
RUN npm run build --workspace=@promotions/api

EXPOSE 3000
CMD ["node", "apps/api/dist/server.js"]
