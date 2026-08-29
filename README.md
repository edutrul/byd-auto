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

## BYD Console APK

`HelloBYD.apk` stays a zero-permission installation proof. The separate
`BYDConsole.apk` is a constrained WebView shell for the secured gateway and
therefore requests **only** `INTERNET`. It neither stores the gateway token nor
embeds SSH, Codex, Claude, or Herdr credentials.

```bash
chmod +x build-console.sh
./build-console.sh
```

The shell is hard-coded to `https://byd.eduardotelaya.com/` and blocks
navigation away from that origin. Build it only after the HTTPS endpoint in
[`docs/DIRECT_ACCESS.md`](docs/DIRECT_ACCESS.md) is operational.
If TLS or network loading fails, it cancels the connection and displays a
retryable diagnostic screen; it never bypasses certificate validation.

## Herdr terminal gateway proof

The repository now includes the first remote-control vertical slice:

```text
browser/xterm.js → WebSocket → Herdr remote-tes → existing terminal PTY
```

It lists existing Herdr terminals, renders live ANSI frames, forwards terminal
input through the local Herdr socket API, and reconnects without restarting the
underlying Codex or Claude process. The gateway is loopback-only by default and
never sends SSH keys or agent credentials to the browser.

See [`docs/HERDR_GATEWAY.md`](docs/HERDR_GATEWAY.md) for the verified Herdr
0.8.2 APIs, security model, VPS commands, and smoke tests.

For the exact laptop tunnel, browser test steps, and troubleshooting handoff,
see [`docs/HANDOFF.md`](docs/HANDOFF.md).

For direct BYD browser access after the proof, see
[`docs/DIRECT_ACCESS.md`](docs/DIRECT_ACCESS.md). It uses Caddy TLS in front of
the still-loopback-only gateway; it never exposes the Bun port itself.

### Phone-assisted pairing

On the BYD console, tap **PAIR BY PHONE**. It displays a short-lived QR code.
Scan it with a phone, enter the gateway token on the phone page, and return to
the console; the existing WebSocket is then authorized and lists terminals.

The QR contains only a random one-time pairing ID, never the gateway token.
The token is submitted over same-origin HTTPS directly to the VPS, used to
authorize the waiting WebSocket, and is not sent back to the car. QR codes
expire after two minutes; tap **NEW QR** to try again. Manual token entry
remains available below the QR as a fallback.

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
build-console.sh                            BYDConsole APK build/sign pipeline
console/                                    Minimal Internet-only Android WebView shell
server/                                     Bun WebSocket/Herdr gateway proof
web/                                        Touch-friendly xterm.js proof client
docs/HERDR_GATEWAY.md                       Verified protocol and operations
docs/HANDOFF.md                             Fast laptop/VPS test and handoff guide
docs/DIRECT_ACCESS.md                       HTTPS/WSS VPS deployment runbook
deploy/                                     Caddy and systemd deployment templates
CLAUDE.md                                   Repository workflow guidance
```
