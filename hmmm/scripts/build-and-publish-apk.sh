#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_DIR="$ROOT_DIR/hmmm"
APK_TARGET="$ROOT_DIR/deploy/downloads/pi-quiz.apk"

cd "$APP_DIR"

PROJECT_ID="$(node -e 'const fs = require("fs"); const c = JSON.parse(fs.readFileSync("app.json", "utf8")); process.stdout.write(c?.expo?.extra?.eas?.projectId || "");')"
if [[ -z "$PROJECT_ID" ]]; then
  echo "EAS project not configured in app.json."
  echo "Run once: npx eas-cli init"
  exit 1
fi

echo "[1/4] Building Android APK with EAS..."
BUILD_JSON="$(npx eas-cli build --platform android --profile preview --wait --non-interactive --json)"

ARTIFACT_URL="$(node -e 'const data = JSON.parse(process.argv[1]); const item = Array.isArray(data) ? data[0] : data; const url = item?.artifacts?.buildUrl || ""; if (!url) process.exit(2); process.stdout.write(url);' "$BUILD_JSON")"

if [[ -z "$ARTIFACT_URL" ]]; then
  echo "Failed to resolve APK artifact URL from EAS output."
  exit 1
fi

echo "[2/4] Downloading APK artifact..."
mkdir -p "$(dirname "$APK_TARGET")"
curl -fL "$ARTIFACT_URL" -o "$APK_TARGET"

echo "[3/4] Publishing APK via git push..."
cd "$ROOT_DIR"
git add "$APK_TARGET"
if git diff --cached --quiet; then
  echo "No APK changes to publish."
else
  git commit -m "chore: publish latest android apk"
  git push azure master
fi

echo "[4/4] Done. APK URL: https://pit.engineer/downloads/pi-quiz.apk"
