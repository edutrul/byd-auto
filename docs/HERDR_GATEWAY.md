# Herdr terminal gateway proof

This proof connects a browser/xterm.js terminal to an existing Herdr terminal
without starting or duplicating the Codex or Claude process inside it.

## Verified Herdr 0.8.2 interfaces

The named session `remote-tes` exposes two Unix sockets:

```text
~/.config/herdr/sessions/remote-tes/herdr.sock
~/.config/herdr/sessions/remote-tes/herdr-client.sock
```

- `herdr.sock` uses newline-delimited JSON, protocol 20. The gateway uses
  `pane.list`, `agent.list`, and `pane.send_text` directly.
- `herdr-client.sock` is Herdr's binary thin-client/render protocol. Rather than
  duplicating that private protocol, the gateway runs the official read-only
  adapter:

  ```bash
  herdr --session remote-tes terminal session observe <pane-id> --cols 100 --rows 30
  ```

  It emits one JSON envelope per rendered frame. Frames contain base64 ANSI
  bytes, sequence, dimensions, and whether the frame is full or incremental.

The public `pane.output_matched` subscription is intentionally edge-triggered:
it fires when a configured match changes from false to true. It is useful for
automation, but is not a general continuous terminal stream. The terminal
session observer is the correct rendered-output interface.

## Data path

```text
Browser/xterm.js
      │ WebSocket (JSON)
      ▼
Bun gateway on VPS (loopback by default)
      ├── pane/agent inventory ──► herdr.sock
      ├── keyboard bytes ────────► pane.send_text ──► existing PTY
      └── rendered ANSI ◄──────── terminal session observe
                                      │
                                      └── herdr-client.sock
```

Closing a WebSocket only terminates its read-only observer process. Herdr and
the terminal's Codex/Claude process continue running. Reconnecting and selecting
the pane starts a fresh observer and receives a full frame.

## Run on the VPS

Requires Bun 1.4+ and Herdr 0.8.2+:

```bash
export HERDR_SESSION=remote-tes
export HERDR_GATEWAY_TOKEN="$(openssl rand -hex 24)"
bun run server/gateway.js
```

The gateway binds `127.0.0.1:8790` by default. Port 8787 is already used by the
installed Herdr Collie plugin on this VPS. For a laptop proof, keep the gateway on
loopback and create an authenticated SSH tunnel:

```bash
ssh -L 8790:127.0.0.1:8790 launchpad-codex
```

Then open `http://127.0.0.1:8790`, enter the narrow gateway token, connect, and
select a terminal.

For BYD access, place the loopback gateway behind an HTTPS/WSS reverse proxy and
device-scoped authentication. Do not expose port 8790 directly to the Internet.

## Security properties

- No SSH key, GitHub token, Codex credential, or Claude credential is returned
  to the browser.
- Inventory responses omit cwd, quota metadata, agent session identifiers, and
  other unnecessary server state.
- A token is mandatory if the gateway binds beyond loopback.
- The HTTP response uses a restrictive Content Security Policy and same-origin
  WebSocket upgrades.
- Terminal input is limited to 16 KiB per WebSocket message and sent only to the
  explicitly selected live pane.

## Smoke test

On the VPS:

```bash
bun run server/smoke.js
```

The smoke test lists live terminals, receives a rendered ANSI frame through the
official observer, and exercises `pane.send_text` with an empty non-mutating
payload. It never starts, restarts, or prompts an agent.

## Version authority

Use the installed binary as the authority:

```bash
herdr --version
herdr --session remote-tes api schema --json
herdr --session remote-tes terminal session observe --help
```

This implementation was verified against Herdr 0.8.2, socket protocol 20,
schema version 1.
