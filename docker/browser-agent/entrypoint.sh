#!/bin/bash
set -e

# If headed mode is requested, start Xvfb + VNC before running the agent
if [ "${HEADED}" = "true" ] || [ "${HEADED}" = "1" ]; then
    echo "Starting Xvfb and VNC for headed mode..."
    export DISPLAY=:99
    Xvfb :99 -screen 0 1280x720x24 &
    sleep 1
    fluxbox &
    x11vnc -display :99 -nopw -forever -shared &
    echo '{"type":"vnc","url":"vnc://localhost:5900"}' >&2
    sleep 1
fi

# Map env vars to CLI flags if not provided as args
TASK_ARG="${1:-}"
BASE_URL_ARG="${3:-}"

if [ -z "$TASK_ARG" ] && [ -n "$TASK_DESCRIPTION" ]; then
    set -- "$@" --task "$TASK_DESCRIPTION"
fi
if [ -z "$BASE_URL_ARG" ] && [ -n "$BASE_URL" ]; then
    set -- "$@" --base-url "$BASE_URL"
fi

# Run the browser agent
exec python /agent/orbit_browser_runner.py "$@"
