#!/bin/sh
set -e

echo "[start.sh] Running prisma migrate deploy..."
node node_modules/prisma/build/index.js migrate deploy || {
  echo "[start.sh] prisma migrate deploy failed — trying to continue anyway"
}

echo "[start.sh] Starting server..."
exec node server.js
