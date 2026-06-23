# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:22-alpine@sha256:ab07539e0988b63558ff621f5fbe1077054c39d9809112974fb79993949d41cd AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG CACHEBUST=1
RUN echo "Cache bust: $CACHEBUST" && npm run build


# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:22-alpine@sha256:ab07539e0988b63558ff621f5fbe1077054c39d9809112974fb79993949d41cd AS runner

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

# Create non-root user and app directory with correct ownership in one step
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && mkdir -p /app && chown appuser:appgroup /app

# Switch to non-root — all subsequent steps run as appuser
USER appuser
WORKDIR /app

COPY --chown=appuser:appgroup package*.json ./
RUN npm ci --omit=dev

COPY --chown=appuser:appgroup --from=builder /app/dist ./dist
COPY --chown=appuser:appgroup --from=builder /app/shared ./shared

EXPOSE 8080
CMD ["node", "dist/server/index.js"]
