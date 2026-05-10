# Stage 1: Build the Nuxt application
FROM node:20-bookworm-slim AS builder

# Install bun for building
RUN npm install -g bun

WORKDIR /app

# Copy package files and install dependencies
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the Nuxt application
RUN bun run build

# Stage 2: Run the Nuxt application and the agent runtime
FROM node:20-bookworm-slim AS runner

# Install bun in the runner, as well as necessary system dependencies for git, gh, glab, and the agent runtime
RUN npm install -g bun \
    && apt-get update && apt-get install -y \
    git \
    curl \
    unzip \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && curl -sL "https://gitlab.com/gitlab-org/cli/-/raw/main/scripts/install.sh" | bash \
    && rm -rf /var/lib/apt/lists/*

# Set up working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/.output /app/.output

# Copy opencode configurations
COPY opencode/opencode.json /root/.config/opencode/opencode.json
COPY opencode/AGENTS.md /root/.config/opencode/AGENTS.md

# Expose Nuxt port
EXPOSE 3000

# Set environment variables for Nuxt
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Start the Nuxt server
CMD ["node", ".output/server/index.mjs"]
