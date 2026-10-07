# Use the official Playwright image which bundles Chromium
FROM mcr.microsoft.com/playwright:v1.43.1-jammy AS base
WORKDIR /app

# Copy root workspace manifests
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/

# Install workspace deps
RUN npm install --workspace=@promotions/shared --workspace=@promotions/worker

# Copy source
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker
COPY tsconfig.base.json ./

# Build
RUN npm run build --workspace=@promotions/shared
RUN npm run build --workspace=@promotions/worker

CMD ["node", "apps/worker/dist/index.js"]
