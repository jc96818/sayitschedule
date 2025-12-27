# Multi-stage build for Say It Schedule

# ==========================================
# Stage 1: Build Frontend
# ==========================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY frontend/ ./

# Build the frontend
RUN npm run build

# ==========================================
# Stage 2: Build Backend
# ==========================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY backend/ ./

# Build TypeScript
RUN npm run build

# ==========================================
# Stage 3: Production Image
# ==========================================
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy Prisma schema and migrations (needed for prisma migrate deploy)
COPY --from=backend-builder /app/backend/prisma ./prisma

# Generate Prisma client for production (must be done after npm ci and copying prisma folder)
RUN npx prisma generate

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./dist

# Copy built frontend to serve as static files
COPY --from=frontend-builder /app/frontend/dist ./public

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the server
CMD ["node", "dist/server.js"]
