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

# Run the browser agent
exec python /agent/orbit_browser_runner.py "$@"
