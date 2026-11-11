#!/usr/bin/env bash
# Builds a signed APK without Gradle: aapt + javac + dex + zipalign + apksigner.
#
# Either use the Android SDK (set ANDROID_HOME; needs build-tools and a platform, e.g.
#   sdkmanager "build-tools;34.0.0" "platforms;android-34"),
# or the Debian/Ubuntu packages:
#   sudo apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 openjdk-17-jdk-headless
#
# Signing: set KS_PASS to the keystore password (or KS_PASS_FILE to a file holding it). The key (release.keystore, or KS_FILE)
# is created on the first build and is NOT in the repository: keep it and its password to update an installed app.
set -euo pipefail
cd "$(dirname "$0")"
VERSION_CODE=${VERSION_CODE:-4}; VERSION_NAME=${VERSION_NAME:-2.1}
OUT=build; rm -rf $OUT; mkdir -p $OUT/classes

if [ -n "${ANDROID_HOME:-}" ] && ls "$ANDROID_HOME"/build-tools/*/aapt >/dev/null 2>&1; then
  BT=$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)
  JAR=${ANDROID_JAR:-$(ls "$ANDROID_HOME"/platforms/android-*/android.jar | sort -V | tail -1)}
  AAPT=$BT/aapt; ZIPALIGN=$BT/zipalign; APKSIGNER=$BT/apksigner
  # the d8 in cmdline-tools is newer than the one in build-tools and copes with class files from recent JDKs
  D8=$ANDROID_HOME/cmdline-tools/latest/bin/d8; [ -x "$D8" ] || D8=$BT/d8
  dex() { "$D8" --release --min-api 21 --lib "$JAR" --output "$OUT" $(find $OUT/classes -name '*.class'); }
else
  JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
  AAPT=aapt; ZIPALIGN=zipalign; APKSIGNER=apksigner
  dex() { dalvik-exchange --dex --min-sdk-version=21 --output=$OUT/classes.dex $OUT/classes; }
fi

"$AAPT" package -f -m -J "$OUT" -M app/src/main/AndroidManifest.xml -S app/src/main/res -I "$JAR"

javac --release 8 -nowarn -classpath "$JAR" -d $OUT/classes $(find app/src/main/java "$OUT/app" -name '*.java')
dex
"$AAPT" package -f -M app/src/main/AndroidManifest.xml -S app/src/main/res -A app/src/main/assets \
  -I "$JAR" --min-sdk-version 21 --target-sdk-version 34 --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" -F $OUT/unsigned.apk
(cd $OUT && "$AAPT" add unsigned.apk classes.dex >/dev/null)
"$ZIPALIGN" -f -p 4 $OUT/unsigned.apk $OUT/aligned.apk

if [ -z "${KS_PASS:-}" ] && [ -n "${KS_PASS_FILE:-}" ]; then KS_PASS=$(cat "$KS_PASS_FILE"); fi
: "${KS_PASS:?set KS_PASS (or KS_PASS_FILE) to the keystore password}"
export KS_PASS
KS=${KS_FILE:-release.keystore}
[ -f "$KS" ] || keytool -genkeypair -keystore "$KS" -storepass:env KS_PASS -keypass:env KS_PASS \
  -alias cos -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Chess on Surfaces"
"$APKSIGNER" sign --ks "$KS" --ks-pass env:KS_PASS --key-pass env:KS_PASS --out ChessVariants.apk $OUT/aligned.apk
cp ChessVariants.apk "$OUT/ChessVariants-$VERSION_CODE.apk"
"$APKSIGNER" verify ChessVariants.apk && echo "Built ChessVariants.apk ($VERSION_NAME, code $VERSION_CODE)"
