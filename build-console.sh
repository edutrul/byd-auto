#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
PLATFORM="${ANDROID_PLATFORM:-android-36}"
BUILD_TOOLS="${ANDROID_BUILD_TOOLS:-36.0.0}"
TOOLS="$SDK/build-tools/$BUILD_TOOLS"
ANDROID_JAR="$SDK/platforms/$PLATFORM/android.jar"
OUT="$ROOT/.build-console"
CLASSES="$OUT/classes"
DEX="$OUT/dex"
UNSIGNED="$OUT/BYDConsole-unsigned.apk"
KEYSTORE="$ROOT/.signing/byd-console-debug.keystore"
APK="$ROOT/BYDConsole.apk"

for required in "$TOOLS/aapt2" "$TOOLS/d8" "$TOOLS/apksigner" "$ANDROID_JAR"; do
  if [[ ! -e "$required" ]]; then
    echo "Missing Android SDK component: $required" >&2
    exit 1
  fi
done

rm -rf "$OUT"
mkdir -p "$CLASSES" "$DEX" "$(dirname "$KEYSTORE")"

javac -source 8 -target 8 -encoding UTF-8 \
  -classpath "$ANDROID_JAR" \
  -d "$CLASSES" \
  "$ROOT/console/src/com/devywork/bydconsole/ConsoleActivity.java"

"$TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output "$DEX" \
  "$CLASSES/com/devywork/bydconsole/ConsoleActivity.class" \
  "$CLASSES/com/devywork/bydconsole/ConsoleActivity\$ConsoleWebViewClient.class"

"$TOOLS/aapt2" link \
  -o "$UNSIGNED" \
  --manifest "$ROOT/console/AndroidManifest.xml" \
  -I "$ANDROID_JAR"

(cd "$DEX" && zip -q -u "$UNSIGNED" classes.dex)

if [[ ! -f "$KEYSTORE" ]]; then
  keytool -genkeypair -noprompt \
    -keystore "$KEYSTORE" -storepass android -keypass android \
    -alias androiddebugkey -dname "CN=BYD Console, O=DEVYWORK, C=PE" \
    -keyalg RSA -keysize 2048 -validity 10000 >/dev/null 2>&1
fi

"$TOOLS/zipalign" -f 4 "$UNSIGNED" "$OUT/BYDConsole-aligned.apk"
"$TOOLS/apksigner" sign \
  --ks "$KEYSTORE" --ks-pass pass:android --key-pass pass:android \
  --out "$APK" "$OUT/BYDConsole-aligned.apk"
"$TOOLS/apksigner" verify --verbose "$APK"

echo
echo "Built: $APK"
ls -lh "$APK"
