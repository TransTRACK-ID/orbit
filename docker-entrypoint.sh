#!/bin/sh
set -e

# Decode opencode.json from base64 if the environment variable is provided
if [ -n "$OPENCODE_CONFIG_BASE64" ]; then
  echo "Decoding opencode.json from base64..."
  mkdir -p /root/.config/opencode
  echo "$OPENCODE_CONFIG_BASE64" | base64 -d > /root/.config/opencode/opencode.json
fi

# Execute the original command (e.g., node .output/server/index.mjs)
exec "$@"
