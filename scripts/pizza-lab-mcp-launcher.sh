#!/bin/zsh
set -euo pipefail

PIZZA_LAB_REPO="${0:A:h:h}"
PIZZA_LAB_TOKEN_FILE="$PIZZA_LAB_REPO/.pizza-lab/session-token"

if [[ ! -r "$PIZZA_LAB_TOKEN_FILE" ]]; then
  print -u2 "Pizza Lab session token is missing; see docs/pizza-lab/README.md"
  exit 1
fi

IFS= read -r PIZZA_LAB_TOKEN < "$PIZZA_LAB_TOKEN_FILE"
export PIZZA_LAB_TOKEN
export PIZZA_LAB_MODE=interactive
export PIZZA_LAB_HOST=127.0.0.1
export PIZZA_LAB_PORT=9877

exec node "$PIZZA_LAB_REPO/tools/pizza-lab/mcp/server.mjs"
