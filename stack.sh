#!/usr/bin/env bash
# Orchestration de la stack SFD AgnosticTrace
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
set -a; [ -f .env ] && . ./.env; set +a

API_PORT="${API_PORT:-3000}"
PID_FILE="$PROJECT_DIR/.api.pid"
API_LOG="$PROJECT_DIR/api.log"

start_api() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    echo "API deja active (PID $(cat "$PID_FILE"))"; return
  fi
  nohup node "$PROJECT_DIR/middleware/api/server.js" > "$API_LOG" 2>&1 &
  echo $! > "$PID_FILE"
  echo "API demarree (PID $(cat "$PID_FILE")) -> http://localhost:$API_PORT"
}
stop_api() {
  if [ -f "$PID_FILE" ]; then
    kill "$(cat "$PID_FILE")" 2>/dev/null && echo "API arretee"
    rm -f "$PID_FILE"
  fi
}

case "${1:-}" in
  up)
    echo "== 1/2 PostgreSQL =="
    docker compose up -d postgres
    echo "== 2/2 API =="
    sleep 3; start_api
    echo "Services locaux demarres. Le reseau Fabric et le chaincode n'ont pas ete modifies."
    ;;
  down)
    echo "Arret de la stack..."
    stop_api
    docker compose down
    echo "API et PostgreSQL arretes. Fabric et son ledger n'ont pas ete modifies."
    ;;
  seed)
    node sig-simulator/generator.js --count "${2:-50}"
    node middleware/run-ingest.js
    node middleware/run-audit.js
    node middleware/run-report.js
    ;;
  reset)
    echo "Reinitialisation destructive desactivee pour proteger le ledger Fabric et les donnees PostgreSQL." >&2
    echo "Aucune action effectuee; toute reinitialisation necessite un plan et une autorisation explicites." >&2
    exit 2
    ;;
  status)
    docker ps --format "table {{.Names}}\t{{.Status}}"; echo "---"
    curl -s "http://localhost:$API_PORT/health" && echo
    ;;
  logs) tail -f "$API_LOG" ;;
  
  *) echo "Usage: ./stack.sh {up|down|reset|seed [n]|status|logs}"; exit 1 ;;
esac