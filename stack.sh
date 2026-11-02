#!/usr/bin/env bash
# Orchestration de la stack SFD AgnosticTrace
set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
set -a; [ -f .env ] && . ./.env; set +a

TN="${FABRIC_TN:?Definir FABRIC_TN dans .env}"
CHANNEL="${FABRIC_CHANNEL:-sfdchannel}"
CC_NAME="${FABRIC_CHAINCODE:-agnostictrace}"
CC_PATH="$PROJECT_DIR/chaincode/agnostic-trace"
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
    echo "== 1/4 Reseau Fabric =="
    ( cd "$TN" && ./network.sh down && ./network.sh up createChannel -c "$CHANNEL" )
    echo "== 2/4 Deploiement chaincode =="
    ( cd "$TN" && ./network.sh deployCC -ccn "$CC_NAME" -ccp "$CC_PATH" -ccl javascript -c "$CHANNEL" )
    echo "== 3/4 PostgreSQL =="
    docker compose up -d postgres
    echo "  (note: la base Postgres persiste; si l'audit signale des orphelins, lancez ./stack.sh reset)"
    echo "== 4/4 API =="
    sleep 3; start_api
    echo "Stack demarree. Peupler avec : ./stack.sh seed"
    ;;
  down)
    echo "Arret de la stack..."
    stop_api
    docker compose down
    ( cd "$TN" && ./network.sh down )
    echo "Stack arretee."
    ;;
  seed)
    node sig-simulator/generator.js --count "${2:-50}"
    node middleware/run-ingest.js
    node middleware/run-audit.js
    node middleware/run-report.js
    ;;
  reset)
    echo "Reinitialisation COHERENTE (ledger + base)..."
    stop_api
    docker compose down -v            # -v : supprime le volume Postgres
    ( cd "$TN" && ./network.sh down )
    "$0" up
    ;;
  status)
    docker ps --format "table {{.Names}}\t{{.Status}}"; echo "---"
    curl -s "http://localhost:$API_PORT/health" && echo
    ;;
  logs) tail -f "$API_LOG" ;;
  
  *) echo "Usage: ./stack.sh {up|down|reset|seed [n]|status|logs}"; exit 1 ;;
esac