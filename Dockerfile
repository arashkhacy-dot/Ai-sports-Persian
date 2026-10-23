# Multi-stage production Dockerfile for Persian AI SportsCaster
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json tsconfig.json vite.config.ts ./
RUN npm install

# Copy source files and compile frontend
COPY . .
RUN npm run build

# Production runtime image with FFmpeg
FROM node:22-bookworm-slim AS runner

WORKDIR /app

# Install FFmpeg and required media tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Persistent storage directories
RUN mkdir -p /app/data/uploads /app/data/tts_cache /app/public/live

EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
