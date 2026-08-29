# Repository instructions

- Prefix shell commands with `rtk`.
- Use a real GitHub issue number for every working branch.
- Branch names must use `BYD-<issue-number>-<short-kebab-title>`.
- Pull requests must contain `Closes #<issue-number>`.
- Build and verify `HelloBYD.apk` with `./build.sh` before publishing changes.
- Do not introduce Android permissions without explicit issue scope and user
  approval.
- Keep the Herdr gateway bound to loopback unless it is placed behind HTTPS/WSS
  and narrow device authentication.
- Never expose SSH keys or agent credentials to the browser, and never start a
  Codex/Claude process as a side effect of WebSocket connect/reconnect.
- Do not implement the farm until the terminal gateway proof is complete.
