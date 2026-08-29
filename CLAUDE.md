# CLAUDE.md

## Project

This repository contains a minimal, permission-free Android application used to
test ordinary APK sideloading on BYD DiLink.

## Required workflow

1. Create or identify the GitHub issue before creating a branch.
2. Name the branch `BYD-<issue-number>-<short-kebab-title>`.
3. Keep the branch title aligned with the issue title.
4. Include `Closes #<issue-number>` in the pull request description.
5. Run `./build.sh` and verify the APK signature before opening a pull request.

## Constraints

- Do not add permissions unless the relevant issue explains why they are
  necessary and the pull request calls them out explicitly.
- Prefer a single ordinary APK rather than APKM, XAPK, or split APK output.
- Preserve `.signing/hello-byd-debug.keystore` locally so upgrades retain the
  same signing identity. Never commit the keystore.
- Keep `minSdkVersion` compatible with Android 10-era DiLink systems.
- Treat the BYD/browser as untrusted. Herdr sockets, SSH keys, GitHub tokens,
  and Codex/Claude credentials must remain on the VPS.
- Never start a new Codex or Claude process when a browser connects. Observe
  and control only the explicitly selected existing Herdr terminal.
- Keep the farm deferred until the terminal gateway proof is reliable.

## Commands

```bash
./build.sh
adb install -r HelloBYD.apk
bun run server/smoke.js
bun run server/gateway.js
```
