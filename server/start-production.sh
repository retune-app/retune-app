#!/bin/bash
export PORT=8081
while true; do
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')] Starting server on port $PORT..."
  NODE_ENV=production node server_dist/index.js
  EXIT_CODE=$?
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%S.000Z')] Server exited with code $EXIT_CODE, restarting in 3 seconds..."
  sleep 3
done
