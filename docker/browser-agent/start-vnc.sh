#!/bin/bash
export DISPLAY=:99
Xvfb :99 -screen 0 1280x720x24 &
sleep 1
fluxbox &
x11vnc -display :99 -nopw -forever -shared &
echo '{"type":"vnc","url":"vnc://localhost:5900"}'
