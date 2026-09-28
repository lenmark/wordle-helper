#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f data/words.txt || ! -f data/common.txt ]]; then
  echo "Word lists are missing. Run ./setup.sh first." >&2
  exit 1
fi
PORT="${1:-8000}"
echo "Wordle Word Finder: http://127.0.0.1:${PORT}"
python3 -m http.server "$PORT" --bind 127.0.0.1
