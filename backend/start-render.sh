#!/usr/bin/env bash
set -euo pipefail

# Render provides PORT at runtime.
PORT="${PORT:-10000}"

# Ensure the Flask CLI module is set to our CLI app so we can call init-db.
export FLASK_APP=backend.cli:app

# Run DB initialization (with retries) before starting the web server.
# This makes deployments resilient to DNS/network races where the DB isn't
# immediately reachable.
flask init-db

exec python -m gunicorn backend.app:app \
  --bind "0.0.0.0:${PORT}" \
  --workers 2 \
  --threads 4 \
  --timeout 120
