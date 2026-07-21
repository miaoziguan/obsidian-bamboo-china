#!/usr/bin/env bash
# Sync the built Bamboo China theme artifacts into the target Obsidian vault.
#
# Copies theme.css and manifest.json from the repo root into the vault's
# theme directory. The existing theme.css is backed up (timestamped) before
# being overwritten so a bad build is always recoverable.
#
# Target can be overridden via the BAMBOO_VAULT env var, e.g.:
#   BAMBOO_VAULT=/path/to/your/vault ./sync.sh

set -euo pipefail

# ---- configuration -------------------------------------------------------
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_NAME="Bamboo China"

# Default target vault (override with BAMBOO_VAULT=... ./sync.sh).
DEFAULT_VAULT="/Users/pokerhu/Downloads/CJ/obsidian-vault"
VAULT="${BAMBOO_VAULT:-$DEFAULT_VAULT}"

DEST_DIR="$VAULT/.obsidian/themes/$THEME_NAME"

SRC_CSS="$REPO_ROOT/theme.css"
SRC_MANIFEST="$REPO_ROOT/manifest.json"
DST_CSS="$DEST_DIR/theme.css"
DST_MANIFEST="$DEST_DIR/manifest.json"

# ---- checks --------------------------------------------------------------
if [[ ! -f "$SRC_CSS" ]]; then
  echo "✗ theme.css not found in repo root. Run 'npm run build' first." >&2
  exit 1
fi
if [[ ! -f "$SRC_MANIFEST" ]]; then
  echo "✗ manifest.json not found in repo root." >&2
  exit 1
fi
if [[ ! -d "$DEST_DIR" ]]; then
  echo "✗ theme directory not found: $DEST_DIR" >&2
  echo "  Create it (or set BAMBOO_VAULT) and enable the theme in Obsidian first." >&2
  exit 1
fi

# ---- backup existing theme.css ------------------------------------------
if [[ -f "$DST_CSS" ]]; then
  BACKUP="$DEST_DIR/theme.css.bak.$(date +%Y%m%d%H%M%S)"
  cp "$DST_CSS" "$BACKUP"
  echo "↩  backed up existing theme.css -> ${BACKUP##*/}"
fi

# ---- sync -----------------------------------------------------------------
mkdir -p "$DEST_DIR"
cp "$SRC_CSS" "$DST_CSS"
cp "$SRC_MANIFEST" "$DST_MANIFEST"

echo "✓ synced Bamboo China -> $DEST_DIR"
echo "  theme.css   ($(wc -c < "$SRC_CSS" | tr -d ' ') bytes)"
echo "  manifest.json (v$(grep -o '"version": "[^"]*"' "$SRC_MANIFEST" | head -1 | sed 's/"version": "//;s/"//'))"
echo "  Reload in Obsidian: command palette → 'Reload app without saving'."
