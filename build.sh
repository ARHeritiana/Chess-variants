#!/usr/bin/env bash
# Builds a signed APK without Gradle: aapt + javac + dx + zipalign + apksigner.
# Debian/Ubuntu:  sudo apt install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 openjdk-17-jdk-headless
set -euo pipefail
cd "$(dirname "$0")"
JAR=${ANDROID_JAR:-/usr/lib/android-sdk/platforms/android-23/android.jar}
OUT=build; rm -rf $OUT; mkdir -p $OUT/classes
javac --release 8 -nowarn -classpath "$JAR" -d $OUT/classes $(find app/src/main/java -name '*.java')
dalvik-exchange --dex --min-sdk-version=21 --output=$OUT/classes.dex $OUT/classes
aapt package -f -M app/src/main/AndroidManifest.xml -S app/src/main/res -A app/src/main/assets \
  -I "$JAR" --min-sdk-version 21 --target-sdk-version 34 --version-code 2 --version-name 1.1 -F $OUT/unsigned.apk
(cd $OUT && aapt add unsigned.apk classes.dex >/dev/null)
zipalign -f -p 4 $OUT/unsigned.apk $OUT/aligned.apk
# The signing key is NOT in the repository. Set KS_PASS to the keystore password; the key is created on first build.
: "${KS_PASS:?set KS_PASS to the release.keystore password}"
[ -f release.keystore ] || keytool -genkeypair -keystore release.keystore -storepass "$KS_PASS" -keypass "$KS_PASS" \
  -alias cos -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Chess on Surfaces" >/dev/null 2>&1
apksigner sign --ks release.keystore --ks-pass env:KS_PASS --key-pass env:KS_PASS --out ChessVariants.apk $OUT/aligned.apk
apksigner verify ChessVariants.apk && echo "Built ChessVariants.apk"
