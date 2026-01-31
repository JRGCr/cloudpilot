FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    # Playwright dependencies
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install wrangler globally
RUN npm install -g wrangler

# Create non-root user
RUN useradd -m -s /bin/bash claude

# Set working directory
WORKDIR /app

# Copy package files
COPY --chown=claude:claude package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY --chown=claude:claude apps/api/package.json ./apps/api/
COPY --chown=claude:claude apps/web/package.json ./apps/web/
COPY --chown=claude:claude packages/shared/package.json ./packages/shared/

# Install dependencies as claude user
USER claude
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY --chown=claude:claude . .

# Build shared package
RUN pnpm --filter @cloudpilot/shared build

# Create logs directory
RUN mkdir -p logs && chmod 755 logs

# Expose ports
EXPOSE 8787 5173

# Default command
CMD ["pnpm", "dev"]
