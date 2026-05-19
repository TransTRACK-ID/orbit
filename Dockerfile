# Stage 1: Build the Nuxt application
# Install deps with Bun (fast), build with Node (reliable)
FROM oven/bun:1-slim AS builder

WORKDIR /app

# Accept AUTH_ORIGIN as build argument (set this to your Coolify domain in Coolify UI)
ARG AUTH_ORIGIN
ENV AUTH_ORIGIN=${AUTH_ORIGIN:-http://localhost:3000}

# Install Node.js 20 in the builder — needed for reliable Nuxt/Vite builds
# Bun uses JavaScriptCore and doesn't respect NODE_OPTIONS / V8 flags,
# which causes hangs during Vite transform on large apps.
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile && rm -rf /tmp/*

# Copy the rest of the application code
COPY . .

# Build the Nuxt application with Node (not Bun) to avoid hangs
# Temporarily move server/templates out of the way so Nuxt doesn't scan
# the embedded starter projects (which have their own app.vue, pages/, etc.)
# during the build. Restored after build for runtime template copying.
RUN mv server/templates /tmp/templates-stash

ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npx nuxt build

# Restore templates after build
RUN mv /tmp/templates-stash server/templates

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
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install bun in the runner (needed for agent runtime / opencode)
RUN npm install -g bun && rm -rf /tmp/*

# Install opencode CLI (the actual agent runtime)
# The package name on npm is 'opencode-ai', binary is 'opencode'
# bun puts global binaries in /root/.bun/bin which is not on $PATH by default.
RUN bun install -g opencode-ai \
    && mkdir -p /root/.opencode/bin \
    && ln -sf /root/.bun/bin/opencode /root/.opencode/bin/opencode \
    && /root/.opencode/bin/opencode --version

# Install GitHub CLI (gh)
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && rm -rf /var/lib/apt/lists/*

# Install Docker CLI (needed to spawn browser-agent containers from the web container)
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && chmod a+r /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian bookworm stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Install GitLab CLI (glab)
RUN export ARCH=$(dpkg --print-architecture) \
    && export LATEST_TAG=$(curl -s "https://gitlab.com/api/v4/projects/34675721/releases" | grep -oP '"tag_name":"v\K[^"]+' | head -n 1) \
    && curl -sL "https://gitlab.com/gitlab-org/cli/-/releases/v${LATEST_TAG}/downloads/glab_${LATEST_TAG}_linux_${ARCH}.tar.gz" | tar -xz -C /usr/local/bin --strip-components=1 bin/glab

# Install RTK (Rust Token Killer) — CLI proxy that reduces LLM token consumption by 60-90%
RUN curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh | sh \
    && ln -sf /root/.local/bin/rtk /usr/local/bin/rtk \
    && rtk --version

# Set up working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/.output /app/.output

# Copy server data and templates (required by project-templates.ts at runtime)
COPY --from=builder /app/server/data /app/server/data
COPY --from=builder /app/server/templates /app/server/templates

# Copy opencode AGENTS.md and RTK plugin (non-sensitive, can stay as files)
COPY opencode/AGENTS.md /root/.config/opencode/AGENTS.md
RUN mkdir -p /root/.config/opencode/plugins
COPY opencode/plugins/rtk.ts /root/.config/opencode/plugins/rtk.ts

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
