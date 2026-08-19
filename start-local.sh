#!/usr/bin/env bash
set -euo pipefail

# Canonical local startup path. It intentionally does not use npx: npx may
# select a stale temporary cache even when the checkout and profile are fresh.

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
HARNESS_ROOT="${DSH_ROOT:-$SCRIPT_DIR/../deepseek-harness}"
PROFILE="${DSH_PROFILE:-web}"
HOST="${DSH_HOST:-127.0.0.1}"
PORT="${DSH_PORT:-3080}"
CHECK_ONLY=false
SKIP_BUILD=false

say() { printf '[dsh-start] %s\n' "$*"; }
die() { printf '[dsh-start] error: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Start DSH from the source Harness checkout with linked local plugins.

Usage:
  ./start-local.sh [options]

Options:
  --harness-root PATH  Harness source checkout (default: ../deepseek-harness)
  --profile NAME       DSH profile (default: web)
  --host HOST          Web host (default: 127.0.0.1)
  --port PORT          Web port (default: 3080)
  --check              Validate the source/profile/build without starting DSH
  --skip-build         Do not rebuild Harness and resource-center artifacts
  -h, --help           Show this help

The normal path rebuilds the Harness Host/Client libraries and the resource
center client bundle, verifies profile link targets, then runs `pnpm dsh` from
the Harness checkout. It never starts through npx.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --harness-root)
      [ "$#" -ge 2 ] || die '--harness-root requires a value'
      HARNESS_ROOT="$2"
      shift 2
      ;;
    --profile)
      [ "$#" -ge 2 ] || die '--profile requires a value'
      PROFILE="$2"
      shift 2
      ;;
    --host)
      [ "$#" -ge 2 ] || die '--host requires a value'
      HOST="$2"
      shift 2
      ;;
    --port)
      [ "$#" -ge 2 ] || die '--port requires a value'
      PORT="$2"
      shift 2
      ;;
    --check)
      CHECK_ONLY=true
      shift
      ;;
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown option: $1 (use --help)"
      ;;
  esac
done

command -v node >/dev/null 2>&1 || die 'node is required'
command -v pnpm >/dev/null 2>&1 || die 'pnpm is required; do not replace it with npx for this startup path'

HARNESS_ROOT="$(CDPATH= cd -- "$HARNESS_ROOT" && pwd)"
PROFILE_ROOT="${DSH_HOME:-${HOME:?HOME is required}/.dsh}/profiles/$PROFILE"
PLUGIN_ROOT="$SCRIPT_DIR"

[ -f "$HARNESS_ROOT/package.json" ] || die "Harness source checkout not found: $HARNESS_ROOT"
[ -f "$PROFILE_ROOT/package.json" ] || die "profile not found: $PROFILE_ROOT; install the local bundles first"

if [ "$SKIP_BUILD" = false ]; then
  say 'building Harness Host/Client libraries from the current source checkout'
  (cd "$HARNESS_ROOT" && pnpm run build:lib)
  say 'building resource-center client bundle from the current source checkout'
  (cd "$PLUGIN_ROOT/resource-center-plugin" && node scripts/build-client.js)
else
  say 'build skipped by explicit request'
fi

node "$PLUGIN_ROOT/scripts/verify-local-runtime.mjs" \
  --profile-root "$PROFILE_ROOT" \
  --plugin-root "$PLUGIN_ROOT" \
  --harness-root "$HARNESS_ROOT"

(cd "$PLUGIN_ROOT/resource-center-plugin" && node scripts/build-client.js --check)

if [ "$CHECK_ONLY" = true ]; then
  say 'preflight passed; DSH was not started'
  exit 0
fi

if command -v lsof >/dev/null 2>&1; then
  LISTENER="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"
  if [ -n "$LISTENER" ]; then
    die "${HOST}:${PORT} is already in use; stop the exact existing DSH process before starting another one\n$LISTENER"
  fi
fi

say "starting source Harness: profile=$PROFILE host=$HOST port=$PORT"
cd "$HARNESS_ROOT"
exec pnpm dsh --profile "$PROFILE" web --host "$HOST" --port "$PORT"
