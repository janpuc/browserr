# syntax=docker/dockerfile:1

# Debian slim (glibc) is used across all stages so libsql's native binary stays
# ABI-consistent between build and runtime. Multi-arch: build with
#   docker buildx build --platform linux/amd64,linux/arm64 -t browserr .

FROM node:24.18.0-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.18.0-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24.18.0-bookworm-slim AS runner
WORKDIR /app
# CI passes the release version (git tag) here; falls back to package.json.
ARG BROWSERR_VERSION=""
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    BROWSERR_VERSION=$BROWSERR_VERSION \
    DATABASE_URL=sqlite:///data/browserr.db

# Non-root user + a writable volume for the SQLite database.
RUN groupadd -g 1001 nodejs \
 && useradd -u 1001 -g nodejs -m nextjs \
 && mkdir -p /data && chown nextjs:nodejs /data

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Next.js standalone server entrypoint.
CMD ["node", "server.js"]
