#!/bin/sh
set -e

# Decode opencode.json from base64 if the environment variable is provided
if [ -n "$OPENCODE_CONFIG_BASE64" ]; then
  echo "Decoding opencode.json from base64..."
  mkdir -p /root/.config/opencode
  echo "$OPENCODE_CONFIG_BASE64" | base64 -d > /root/.config/opencode/opencode.json
fi

CHROME_BIN="${CHROME_PATH:-/usr/bin/chromium}"
if [ -x "$CHROME_BIN" ]; then
  echo "Chromium ready: $($CHROME_BIN --version 2>&1 | head -1)"
else
  echo "WARNING: Chromium not found at $CHROME_BIN — rebuild the image (Browser MCP requires Dockerfile chromium layer)"
fi
if command -v chrome-devtools-mcp >/dev/null 2>&1; then
  echo "chrome-devtools-mcp: $(command -v chrome-devtools-mcp)"
else
  echo "WARNING: chrome-devtools-mcp not on PATH — Browser MCP may fall back to npx"
fi

# Execute the original command (e.g., node .output/server/index.mjs)
exec "$@"
