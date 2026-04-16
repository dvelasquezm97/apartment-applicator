#!/usr/bin/env bash
# BerlinKeys Extension — Build Script
#
# Compiles TypeScript files to plain JS for the Chrome extension.
# Requires: npm install -g typescript @anthropic-ai/tool-types
#           npm install --save-dev @types/chrome
#
# Usage: cd extension && bash build.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Building BerlinKeys extension..."

# Install @types/chrome if not present
if [ ! -d "node_modules/@types/chrome" ]; then
  echo "Installing @types/chrome..."
  npm init -y 2>/dev/null || true
  npm install --save-dev @types/chrome
fi

# Compile TypeScript → JavaScript
echo "Compiling TypeScript..."
npx tsc --project tsconfig.json

# Remove import/export statements (Chrome MV3 service workers don't support ESM)
# The TS files are written without imports, so this is just a safety net
for f in background.js content.js popup.js; do
  if [ -f "$f" ]; then
    # Remove any "export {};" that tsc might add
    sed -i '' 's/^export {};//g' "$f" 2>/dev/null || sed -i 's/^export {};//g' "$f"
    echo "  Built: $f"
  fi
done

echo "Build complete. Load extension/ as unpacked extension in chrome://extensions/"
