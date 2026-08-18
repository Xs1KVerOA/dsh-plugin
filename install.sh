#!/usr/bin/env bash
set -euo pipefail

# Install the local DSH bundle without editing a profile manifest by hand.
# Usage: ./install.sh [--profile web] [--dry-run] [--start]

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PLUGIN_DIR="${DSH_PLUGIN_DIR:-$SCRIPT_DIR/resource-center-plugin}"
PROFILE="${DSH_PROFILE:-web}"
USER_HOME_DIR="${HOME:-${USERPROFILE:-}}"
DSH_HOME_DIR="${DSH_HOME:-$USER_HOME_DIR/.dsh}"
DRY_RUN=false
START=false
REMOVE=false

say() { printf '[dsh-install] %s\n' "$*"; }
die() { printf '[dsh-install] error: %s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
Install the local dsh-resource-center bundle into a DSH profile.

Usage:
  ./install.sh [options]

Options:
  --profile NAME       Target profile (default: web)
  --plugin-dir PATH    Bundle directory (default: ./resource-center-plugin)
  --dry-run            Print checks and commands without changing the profile
  --remove             Remove the bundle from the target profile
  --start              Start `dsh web` after a successful install
  -h, --help           Show this help

Environment:
  DSH_HOME             DSH home directory (default: ~/.dsh)
  DSH_CMD              dsh executable path (default: dsh, then npx fallback)
  DSH_PROFILE          Default profile name
  DSH_PLUGIN_DIR       Default local bundle directory
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --profile)
      [ "$#" -ge 2 ] || die '--profile requires a value'
      PROFILE="$2"
      shift 2
      ;;
    --plugin-dir)
      [ "$#" -ge 2 ] || die '--plugin-dir requires a value'
      PLUGIN_DIR="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --remove)
      REMOVE=true
      shift
      ;;
    --start)
      START=true
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

command -v node >/dev/null 2>&1 || die 'node is required to validate the bundle and profile'

if [ ! -d "$PLUGIN_DIR" ]; then
  die "bundle directory not found: $PLUGIN_DIR"
fi
[ -f "$PLUGIN_DIR/package.json" ] || die "missing bundle manifest: $PLUGIN_DIR/package.json"
[ -f "$PLUGIN_DIR/cordis.patch.yml" ] || die "missing bundle patch: $PLUGIN_DIR/cordis.patch.yml"

PACKAGE_NAME="$(node -e '
const fs = require("node:fs");
const path = process.argv[1];
const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
if (!pkg.name || !pkg.dsh?.bundle?.patch) process.exit(2);
process.stdout.write(pkg.name);
' "$PLUGIN_DIR/package.json")" || die 'package.json must declare name and dsh.bundle.patch'

PROFILE_DIR="$DSH_HOME_DIR/profiles/$PROFILE"

if [ -n "${DSH_CMD:-}" ]; then
  DSH_CLI=("$DSH_CMD")
elif command -v dsh >/dev/null 2>&1; then
  DSH_CLI=(dsh)
elif command -v npx >/dev/null 2>&1; then
  DSH_CLI=(npx -y --package @deepseek-ai/dsh dsh)
else
  die 'dsh and npx were not found; install DSH or set DSH_CMD'
fi

say "bundle: $PACKAGE_NAME"
say "profile: $PROFILE_DIR"
say "command: ${DSH_CLI[*]}"

if [ "$DRY_RUN" = true ]; then
  if [ "$REMOVE" = true ]; then
    say '[dry-run] remove the bundle from the profile'
  else
    say "[dry-run] ${DSH_CLI[*]} plugin --profile $PROFILE add $PLUGIN_DIR"
    say '[dry-run] verify dsh.profile.bundles and dump the composed config'
    [ "$START" = true ] && say "[dry-run] ${DSH_CLI[*]} web --profile $PROFILE"
  fi
  exit 0
fi

if [ "$REMOVE" = true ]; then
  say "removing $PACKAGE_NAME from profile $PROFILE"
  "${DSH_CLI[@]}" plugin --profile "$PROFILE" remove "$PACKAGE_NAME"
  say 'removed'
  exit 0
fi

say "installing local bundle into profile $PROFILE"
"${DSH_CLI[@]}" plugin --profile "$PROFILE" add "$PLUGIN_DIR"

PROFILE_MANIFEST="$PROFILE_DIR/package.json"
[ -f "$PROFILE_MANIFEST" ] || die "profile manifest was not created: $PROFILE_MANIFEST"
node -e '
const fs = require("node:fs");
const path = process.argv[1];
const expected = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(path, "utf8"));
const bundles = pkg.dsh?.profile?.bundles || [];
if (!bundles.includes(expected)) {
  console.error(`bundle not registered: ${expected}`);
  process.exit(1);
}
' "$PROFILE_MANIFEST" "$PACKAGE_NAME"

say 'bundle registered; validating composed config'
"${DSH_CLI[@]}" --profile "$PROFILE" --dump-config >/dev/null
say 'installation complete'

if [ "$START" = true ]; then
  exec "${DSH_CLI[@]}" web --profile "$PROFILE"
fi

say "restart with: ${DSH_CLI[*]} web --profile $PROFILE"
say 'after startup, hard-refresh the Web UI (Cmd/Ctrl+Shift+R)'
