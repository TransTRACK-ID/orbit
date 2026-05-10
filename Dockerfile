# Stage 1: Build the Nuxt application
# Using official bun image (smaller, no need to install bun separately)
FROM oven/bun:1-slim AS builder

WORKDIR /app

# Accept AUTH_ORIGIN as build argument (set this to your Coolify domain in Coolify UI)
ARG AUTH_ORIGIN
ENV AUTH_ORIGIN=${AUTH_ORIGIN:-http://localhost:3000}

# Copy package files and install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile && rm -rf /tmp/*

# Copy the rest of the application code
COPY . .

# Build the Nuxt application
RUN bun run build

# Stage 2: Run the Nuxt application and the agent runtime
# Using node image for production runtime (better compatibility with auth packages like jose/openid-client)
FROM node:20-bookworm-slim AS runner

# Install base system dependencies FIRST (needed by opencode install script)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    unzip \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install bun in the runner (needed for agent runtime / opencode)
RUN npm install -g bun && rm -rf /tmp/*

# Install opencode CLI (the actual agent runtime)
# Explicitly set HOME so the installer knows where to put the binary
RUN export HOME=/root \
    && curl -fsSL https://opencode.ai/install.sh | NONINTERACTIVE=1 sh \
    && ls -la /root/.opencode/bin/ \
    && /root/.opencode/bin/opencode --version

# Install GitHub CLI (gh)
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Install GitLab CLI (glab)
RUN export ARCH=$(dpkg --print-architecture) \
    && export LATEST_TAG=$(curl -s "https://gitlab.com/api/v4/projects/34675721/releases" | grep -oP '"tag_name":"v\K[^"]+' | head -n 1) \
    && curl -sL "https://gitlab.com/gitlab-org/cli/-/releases/v${LATEST_TAG}/downloads/glab_${LATEST_TAG}_linux_${ARCH}.tar.gz" | tar -xz -C /usr/local/bin --strip-components=1 bin/glab

# Set up working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/.output /app/.output

# Copy opencode AGENTS.md (non-sensitive, can stay as a file)
COPY opencode/AGENTS.md /root/.config/opencode/AGENTS.md

# Copy and set up entrypoint script for decoding base64 config
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose Nuxt port
EXPOSE 3000

# Set environment variables for Nuxt
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# IMPORTANT: Use node (not bun) for production server runtime.
# Bun has module resolution issues with jose/openid-client used by @sidebase/nuxt-auth.
# The builder stage still uses bun for faster builds, but runtime uses node for compatibility.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", ".output/server/index.mjs"]
