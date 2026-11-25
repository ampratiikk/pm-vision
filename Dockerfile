# Multi-stage production build for PM Vision Monorepo
FROM node:22-alpine AS builder

RUN apk update && apk upgrade --no-cache

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install full dependencies for building
RUN npm ci

# Copy full source tree
COPY . .

# Build shared, server, and client
RUN npm run build

# --- Production Runner Stage ---
FROM node:22-alpine AS runner

RUN apk update && apk upgrade --no-cache

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5000

# Copy manifests for production install
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install only production dependencies
RUN npm ci --omit=dev

# Copy compiled outputs from builder stage
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1:5000/api/health || exit 1

EXPOSE 5000

# Launches Node.js server (serves React app, REST API, and WebSocket on port 5000)
CMD ["npm", "start"]
