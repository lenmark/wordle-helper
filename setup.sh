#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data

python3 - <<'PY'
from pathlib import Path
from urllib.request import Request, urlopen
import re

SOURCES = {
    "common": "https://raw.githubusercontent.com/first20hours/google-10000-english/master/google-10000-english.txt",
    "extended": "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt",
}

HEADERS = {"User-Agent": "wordle-word-finder/1.0"}

def download(url):
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=45) as r:
        return r.read().decode("utf-8", errors="ignore")

def clean(text):
    out = []
    seen = set()
    for raw in text.splitlines():
        w = raw.strip().lower()
        if 2 <= len(w) <= 20 and re.fullmatch(r"[a-z]+", w) and w not in seen:
            seen.add(w)
            out.append(w)
    return out

print("Downloading common English word list...")
common = clean(download(SOURCES["common"]))
print("Downloading extended English word list...")
extended = clean(download(SOURCES["extended"]))

# Keep common-list ordering because it is useful as a rough frequency rank.
Path("data/common.txt").write_text("\n".join(common) + "\n", encoding="utf-8")

# Merge common + extended, de-duplicate, and keep common words first.
seen = set()
merged = []
for w in common + extended:
    if w not in seen:
        seen.add(w)
        merged.append(w)
Path("data/words.txt").write_text("\n".join(merged) + "\n", encoding="utf-8")

print(f"Saved {len(common):,} common words and {len(merged):,} total words.")
PY

echo
echo "Setup complete. Start the app with:"
echo "  ./start.sh"
