# Herdr gateway handoff

This is the working proof of:

```text
browser/xterm.js -> WebSocket -> Herdr -> an existing Codex or Claude terminal
```

It is intentionally **not** an agent farm yet. It observes and controls a
selected, already-running Herdr pane; it does not create, restart, or duplicate
Codex or Claude sessions.

## What is already proven

- The VPS session is named `remote-tes`.
- The gateway lists existing Herdr terminals and agents.
- The browser receives the terminal's live rendered ANSI output.
- Keyboard input is sent only to the selected pane through Herdr's local socket.
- Closing and reopening the browser disconnects only the read-only observer;
  the underlying terminal keeps running.
- The browser never receives SSH keys or agent credentials.

The merged implementation is on `main` at commit `59a7267`.

## Start the private tunnel from the laptop

Keep this terminal open while testing. The command starts the gateway on the
VPS and maps it to laptop-only `127.0.0.1:8790`:

```bash
ssh -i "$HOME/.ssh/id_ed25519" -o IdentitiesOnly=yes \
  -L 8790:127.0.0.1:8790 eduardo@169.58.91.129 \
  'cd "$HOME/byd-auto-gateway" && \
   export HERDR_SESSION=remote-tes && \
   export HERDR_GATEWAY_TOKEN="$(cat .gateway-token)" && \
   exec "$HOME/.local/bin/bun" run server/gateway.js'
```

The direct IP is deliberate: the old `launchpad-codex` SSH alias is not
resolvable on this laptop.

## Open and test it

1. Open [http://127.0.0.1:8790/](http://127.0.0.1:8790/), not the local
   `web/index.html` file.
2. Copy the gateway token to the clipboard, without displaying it:

   ```bash
   ssh -i "$HOME/.ssh/id_ed25519" -o IdentitiesOnly=yes \
     eduardo@169.58.91.129 'cat "$HOME/byd-auto-gateway/.gateway-token"' | pbcopy
   ```

3. Paste it in **Gateway token**, click **Connect**, then click **Refresh**.
4. Select an existing pane. For the Claude proof, choose the entry beginning
   `CLAUDE · w5:p7`.
5. Click **Connect** and confirm the existing terminal output appears. Press
   Enter or type a harmless message to verify input.
6. Reload the page and reconnect to prove the original Claude/Codex session is
   still alive.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `bun: command not found` | Use the command above; noninteractive SSH does not include `~/.local/bin` in `PATH`. |
| `Could not resolve hostname launchpad-codex` | Use `eduardo@169.58.91.129` with the explicit identity command above. |
| Connect appears to do nothing | Check the URL: it must be `http://127.0.0.1:8790/`. A `file:///.../web/index.html` page cannot construct a valid WebSocket endpoint. |
| Port already in use | `8790` is the gateway port. Do not use `8787`; Herdr Collie owns that port on the VPS. |
| No pane output | Click Refresh, choose a live terminal, and connect again. Reconnecting is safe and does not alter the target pane. |

## Before direct access from the BYD

Do **not** expose port 8790 directly. A public subdomain is not required for
the laptop-tunnel proof. When the BYD browser needs direct access, use a
dedicated HTTPS/WSS endpoint (for example `byd.eduardotelaya.com`) behind a
reverse proxy, retain the gateway token, and add device-scoped authentication.
