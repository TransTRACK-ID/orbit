FROM python:3.11-slim

# Install system dependencies:
# - wget, curl, ca-certificates for downloads
# - procps for process management
# - Playwright/Chromium deps
# - Xvfb, x11vnc, fluxbox for headed mode
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget ca-certificates procps curl \
    libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libxkbcommon0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libasound2 \
    libjpeg-dev libpng-dev \
    xvfb x11vnc fluxbox \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /agent

# Copy requirements and install Python deps
COPY requirements.txt /agent/
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browsers
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy agent scripts
COPY entrypoint.sh /agent/
COPY start-vnc.sh /agent/
COPY llm_config.py /agent/
COPY orbit_browser_runner.py /agent/

# Make scripts executable
RUN chmod +x /agent/entrypoint.sh /agent/start-vnc.sh

# Output directory for screenshots and results
RUN mkdir -p /output

ENTRYPOINT ["/agent/entrypoint.sh"]
