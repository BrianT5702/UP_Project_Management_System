#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "==> Pulling latest code from GitHub"
GIT_SSH_COMMAND="ssh -i ~/.ssh/up_github -o IdentitiesOnly=yes" git pull origin main

echo "==> Installing backend packages"
cd "$ROOT/backend"
npm install
pm2 restart unitedpanel-backend

echo "==> Installing frontend packages"
cd "$ROOT/frontend"
npm install --legacy-peer-deps

echo "==> Building frontend"
GENERATE_SOURCEMAP=false npm run build

echo "==> Deploy finished"
echo "Refresh: http://146.190.82.105/unitedpanelsystem/internal_centralized_platform/"
