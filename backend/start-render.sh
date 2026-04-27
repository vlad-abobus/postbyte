#!/usr/bin/env bash
set -euo pipefail

# Render provides PORT at runtime.
PORT="${PORT:-10000}"

exec gunicorn backend.app:app \
  --bind "0.0.0.0:${PORT}" \
  --workers 2 \
  --threads 4 \
  --timeout 120
