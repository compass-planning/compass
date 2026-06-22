# ── Stage 1: Builder ──────────────────────────────────────────────────────────
# Pin to a specific digest to prevent silent upstream changes.
# To update: docker pull node:20-alpine && docker inspect node:20-alpine --format='{{index .RepoDigests 0}}'
# Then replace the sha256 below with the new digest.
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS builder

WORKDIR /app

# Copy lockfile first — layer cache busts only when dependencies change
COPY package*.json ./

# npm ci (not npm install) — enforces package-lock.json exactly, fails on drift
RUN npm ci

COPY . .

ARG CACHEBUST=1
RUN echo "Cache bust: $CACHEBUST" && npm run build


# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install Chromium for Puppeteer PDF generation
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Create a non-root user to run the app.
# Chromium sandbox requires a real user (not root).
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY package*.json ./

# Production deps only — no devDependencies in the image
RUN npm ci --omit=dev

# Copy built output from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/shared ./shared
# Note: scripts/ (DB migrations) intentionally excluded — run migrations
# separately via: flyctl ssh console -C "node scripts/migrate.js"
# or via a one-off Fly machine before deploy.

# Lock down file ownership — appuser owns the app files
RUN chown -R appuser:appgroup /app

# Drop to non-root for all subsequent commands and at runtime
USER appuser

# Only expose the port the app actually serves on
EXPOSE 8080

CMD ["node", "dist/server/index.js"]
