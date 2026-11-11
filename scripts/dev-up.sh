#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example"
fi

docker compose up -d postgres redis

echo "Waiting for Postgres..."
until docker compose exec -T postgres pg_isready -U pindodo -d pindodo >/dev/null 2>&1; do
  sleep 1
done

cd "$ROOT/backend"
# shellcheck disable=SC1091
source .venv/bin/activate
set -a
# shellcheck disable=SC1091
source "$ROOT/.env"
set +a
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. python -m seed.seed_data || true

echo "Start services in separate terminals:"
echo "  backend:  cd backend && source .venv/bin/activate && export \$(grep -v '^#' ../.env | xargs) && PYTHONPATH=. uvicorn app.main:app --reload --port 8000"
echo "  customer: cd apps/customer-web && npm run dev"
echo "  admin:    cd apps/admin-dashboard && npm run dev"
