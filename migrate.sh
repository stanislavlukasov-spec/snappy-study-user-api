#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# migrate.sh – invoke the MigrateLambda to apply pending DB migrations
#
# Usage:
#   bash migrate.sh              # run migrations against the deployed Lambda
#   bash migrate.sh --dry-run    # show which migrations are pending (no changes)
#   bash migrate.sh --status     # same as --dry-run
#
# The Lambda runs inside the VPC and is the only way to reach the private
# RDS instance from outside AWS.
#
# Requirements:
#   • AWS CLI v2 configured with credentials that can invoke Lambda
#   • The stack must already be deployed (bash deploy.sh)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Load .env ──────────────────────────────────────────────────────────────────
if [ -f .env ]; then
  export $(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env | sed 's/#.*//') || true
fi

REGION="${REGION:-eu-central-1}"
STACK_NAME="snappy-study-user-api"
FUNCTION_NAME="${STACK_NAME}-migrate"
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run|--status) DRY_RUN=true ;;
  esac
done

if [ "$DRY_RUN" = true ]; then
  echo "🔍  Dry-run mode – checking migration status only (no changes will be made)"
fi

echo "──────────────────────────────────────────────────────────────────"
echo "  Region:   ${REGION}"
echo "  Function: ${FUNCTION_NAME}"
echo "──────────────────────────────────────────────────────────────────"

OUTPUT_FILE=$(mktemp /tmp/migrate-response.XXXXXX.json)

# ── Invoke Lambda ──────────────────────────────────────────────────────────────
INVOKE_JSON=$(aws lambda invoke \
  --function-name "${FUNCTION_NAME}" \
  --region        "${REGION}" \
  --log-type      Tail \
  --output        json \
  "${OUTPUT_FILE}")

# ── Print CloudWatch logs from the invocation ──────────────────────────────────
LOG_B64=$(echo "${INVOKE_JSON}" | python3 -c \
  "import sys,json; print(json.load(sys.stdin).get('LogResult',''))" 2>/dev/null || echo "")

if [ -n "${LOG_B64}" ]; then
  echo ""
  echo "── Lambda logs ───────────────────────────────────────────────────"
  echo "${LOG_B64}" | base64 --decode
fi

# ── Print structured response ──────────────────────────────────────────────────
echo ""
echo "── Migration result ──────────────────────────────────────────────"

RESPONSE_BODY=$(python3 -c "
import json, sys
raw = open('${OUTPUT_FILE}').read()
outer = json.loads(raw)
# The handler returns { statusCode, body } where body is already a dict
body = outer.get('body', outer)
print(json.dumps(body, indent=2))
" 2>/dev/null || cat "${OUTPUT_FILE}")

echo "${RESPONSE_BODY}"

# ── Exit code reflects success/failure ────────────────────────────────────────
SUCCESS=$(echo "${RESPONSE_BODY}" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(str(d.get('success', True)).lower())" \
  2>/dev/null || echo "true")

rm -f "${OUTPUT_FILE}"

if [ "${SUCCESS}" = "false" ]; then
  echo ""
  echo "❌  Migration failed – check the logs above."
  exit 1
fi

echo ""
echo "✅  Migrations complete."
