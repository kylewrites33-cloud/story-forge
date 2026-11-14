#!/usr/bin/env bash
# EPUBCheck on the Kindle files the app makes (2026-11-14, Docs/Sparrow/21 Kindle Plan.md, Build 1, step 8). A test step only:
# the checker is the W3C's own (https://github.com/w3c/epubcheck), downloaded here, never part of the app. Needs Java.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
ver=5.1.0
jar="$here/epubcheck-$ver/epubcheck.jar"
if [ ! -f "$jar" ]; then
  curl -sSL -o "$here/epubcheck.zip" "https://github.com/w3c/epubcheck/releases/download/v$ver/epubcheck-$ver.zip"
  (cd "$here" && unzip -qo epubcheck.zip && rm epubcheck.zip)
fi
node "$here/make.ts" "$here/out"
status=0
for f in "$here"/out/*.epub; do
  echo "EPUBCheck: $(basename "$f")"
  java -jar "$jar" --failonwarnings "$f" || status=1
done
exit $status
