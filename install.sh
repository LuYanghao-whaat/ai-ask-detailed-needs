#!/usr/bin/env bash
#
# Installer for the ai-ask-detailed-needs opencode skill.
#
# Copies:
#   <repo>/                -> <opencode config>/skills/ai-ask-detailed-needs/
#   <repo>/tools/*.ts      -> <opencode config>/tools/
#
# Usage:
#   bash install.sh
#   bash install.sh --uninstall
#   bash install.sh --project .        # install into ./.opencode instead of the global config

set -euo pipefail

SKILL_NAME="ai-ask-detailed-needs"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

UNINSTALL=0
PROJECT_DIR=""
while [ $# -gt 0 ]; do
  case "$1" in
    --uninstall) UNINSTALL=1 ;;
    --project) shift; PROJECT_DIR="${1:-}" ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

if [ -n "$PROJECT_DIR" ]; then
  [ -d "$PROJECT_DIR" ] || { echo "project directory not found: $PROJECT_DIR" >&2; exit 1; }
  CONFIG_ROOT="$(cd "$PROJECT_DIR" && pwd)/.opencode"
elif [ -n "${XDG_CONFIG_HOME:-}" ]; then
  CONFIG_ROOT="$XDG_CONFIG_HOME/opencode"
else
  CONFIG_ROOT="$HOME/.config/opencode"
fi

SKILL_TARGET="$CONFIG_ROOT/skills/$SKILL_NAME"
TOOL_TARGET="$CONFIG_ROOT/tools/$SKILL_NAME.ts"
TOOL_SOURCE="$REPO_ROOT/tools/$SKILL_NAME.ts"

if [ "$UNINSTALL" = "1" ]; then
  found=0
  if [ -f "$TOOL_TARGET" ]; then rm -f "$TOOL_TARGET"; echo "removed $TOOL_TARGET"; found=1; fi
  if [ -d "$SKILL_TARGET" ]; then rm -rf "$SKILL_TARGET"; echo "removed $SKILL_TARGET"; found=1; fi
  [ "$found" = "0" ] && echo "nothing to remove."
  echo ""
  echo "Restart opencode to apply."
  exit 0
fi

[ -f "$TOOL_SOURCE" ] || { echo "missing $TOOL_SOURCE - run this script from inside the repository." >&2; exit 1; }

echo "opencode config : $CONFIG_ROOT"
echo ""

if [ "$REPO_ROOT" = "$SKILL_TARGET" ]; then
  echo "[=] skill already in place: $SKILL_TARGET"
else
  rm -rf "$SKILL_TARGET"
  mkdir -p "$SKILL_TARGET"
  for item in SKILL.md VERSION assets references README.md LICENSE; do
    [ -e "$REPO_ROOT/$item" ] && cp -R "$REPO_ROOT/$item" "$SKILL_TARGET/"
  done
  echo "[+] skill installed: $SKILL_TARGET"
fi

mkdir -p "$(dirname "$TOOL_TARGET")"
cp -f "$TOOL_SOURCE" "$TOOL_TARGET"
echo "[+] tool installed : $TOOL_TARGET"

echo ""
echo "Done. Restart opencode so it picks up the skill and the tool."
