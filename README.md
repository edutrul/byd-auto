# BYD Auto — HelloBYD

A minimal standalone Android application for testing custom APK sideloading on
BYD DiLink. The screen intentionally does one thing: confirm that an ordinary,
locally built APK can be installed, opened, and recreated after rotation.

```text
HELLO BYD 👋

Custom APK successfully running on DiLink.

DEVYWORK
```

The app also shows whether Android currently reports a portrait or landscape
orientation.

## Privacy

The manifest requests **no permissions**: no Internet, location, Bluetooth,
storage, camera, microphone, or vehicle APIs. It uses only Android framework
APIs and has no third-party runtime dependencies.

## Build

Requirements:

- Java 17
- Android SDK Platform 36
- Android SDK Build Tools 36.0.0

```bash
chmod +x build.sh
./build.sh
```

The ordinary single-file APK is written to `HelloBYD.apk`. The build uses
`javac`, `d8`, `aapt2`, `zipalign`, and `apksigner` directly, so a system Gradle
installation is not required.

The local signing key is created once under `.signing/` and reused. Keep that
key if you want future versions to update an already installed copy.

## Install with ADB (optional)

```bash
adb install -r HelloBYD.apk
```

## GitHub workflow

Every change starts with a GitHub issue. Branches follow:

```text
BYD-<issue-number>-<short-kebab-title>
```

Example: `BYD-12-improve-landscape-layout`. Pull requests must reference their
issue with `Closes #<issue-number>`.

## Project layout

```text
AndroidManifest.xml                         App metadata and permission policy
src/com/devywork/hellobyd/MainActivity.java Responsive Android UI
build.sh                                    Reproducible APK build/sign pipeline
CLAUDE.md                                   Repository workflow guidance
```

