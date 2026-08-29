# Secure direct BYD access

Use this runbook only after the private laptop-tunnel proof is working. It
publishes the console as HTTPS/WSS through `byd.eduardotelaya.com` while the
gateway and the Herdr sockets remain private on the VPS.

```text
BYD browser
  -> HTTPS/WSS byd.eduardotelaya.com (Caddy, TLS)
  -> 127.0.0.1:8790 (Bun gateway)
  -> Herdr Unix sockets / existing terminal
```

## Security boundary

- Caddy is the **only** public listener.
- `HERDR_GATEWAY_HOST` stays `127.0.0.1`; never change it to `0.0.0.0`.
- The browser must supply `HERDR_GATEWAY_TOKEN` over the WSS connection before
  it can list or control a pane.
- The Caddy configuration does not grant shell access and does not expose the
  Herdr Unix socket.
- The gateway still observes/controls an explicitly selected existing pane;
  it never creates a Codex or Claude process.

## Prerequisites

1. A VPS DNS `A`/`AAAA` record for `byd.eduardotelaya.com` pointing to the VPS.
2. Ports 80 and 443 available to Caddy for ACME TLS issuance.
3. Caddy installed on the VPS. Its package must be allowed to bind 80/443.
4. The deployed repository at `/home/eduardo/byd-auto-gateway` and Bun at
   `/home/eduardo/.local/bin/bun`.

## Install gateway service

Run these **on the VPS** after updating the deployed checkout:

```bash
sudo install -D -m 600 deploy/byd-herdr-gateway.env.example /etc/byd-herdr-gateway.env
sudoedit /etc/byd-herdr-gateway.env
# Set HERDR_GATEWAY_TOKEN to: openssl rand -hex 32

sudo install -D -m 644 deploy/byd-herdr-gateway.service \
  /etc/systemd/system/byd-herdr-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable --now byd-herdr-gateway
sudo systemctl status byd-herdr-gateway --no-pager
```

The example runs as `eduardo`, so it can access only that account's Herdr
socket. Do not put tokens into the systemd unit or the Git repository.

## Install Caddy configuration

```bash
sudo install -D -m 644 deploy/Caddyfile /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy --no-pager
```

After DNS has propagated and Caddy reports a certificate, open:

```text
https://byd.eduardotelaya.com/
```

Enter the gateway token, select an existing Herdr terminal, and verify a
harmless keystroke. The WebSocket automatically uses `wss://` under HTTPS.

## Validate and roll back

From the VPS, confirm the Bun gateway remains private:

```bash
ss -ltnp | grep 8790
curl -fsS http://127.0.0.1:8790/ >/dev/null
sudo systemctl status byd-herdr-gateway caddy --no-pager
```

Expected: only `127.0.0.1:8790` is listening for Bun; Caddy owns the public
HTTP/S ports. If deployment misbehaves, immediately stop public access without
touching any running Codex/Claude pane:

```bash
sudo systemctl stop caddy
sudo systemctl stop byd-herdr-gateway
```

Restore the private laptop tunnel described in [HANDOFF.md](HANDOFF.md) to
continue testing. Stopping either service does not stop Herdr or the selected
agent terminal.
