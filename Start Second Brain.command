#!/bin/zsh
# Double-click to run Second Brain locally. Keep this Terminal window open.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

echo ""
echo "  Second Brain — local library"
echo "  ----------------------------"
echo "  Your videos stay in this browser profile on this Mac."
echo "  Keep this window open. Press Ctrl+C to stop."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install it from https://nodejs.org and try again."
  read -r "?Press Return to close."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing the two development dependencies (first run only)…"
  npm install --no-audit --no-fund || { echo "npm install failed."; read -r "?Press Return to close."; exit 1; }
fi

npm run local
read -r "?Server stopped. Press Return to close."
