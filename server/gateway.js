import { randomBytes, timingSafeEqual } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { HerdrSocketClient } from "./herdr-socket.js";

const SESSION = process.env.HERDR_SESSION ?? "remote-tes";
const HOST = process.env.HERDR_GATEWAY_HOST ?? "127.0.0.1";
const PORT = Number(process.env.HERDR_GATEWAY_PORT ?? 8790);
const TOKEN = process.env.HERDR_GATEWAY_TOKEN ?? "";
const HERDR_BIN = process.env.HERDR_BIN ?? join(homedir(), ".local/bin/herdr");
const SOCKET_PATH = process.env.HERDR_SOCKET_PATH
  ?? join(homedir(), `.config/herdr/sessions/${SESSION}/herdr.sock`);
const WEB_ROOT = join(import.meta.dir, "../web");
const herdr = new HerdrSocketClient(SOCKET_PATH);
const PAIRING_TTL_MS = 2 * 60 * 1000;
const pairings = new Map();

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("HERDR_GATEWAY_PORT must be a valid TCP port");
}
if (!TOKEN && !["127.0.0.1", "::1", "localhost"].includes(HOST)) {
  throw new Error("HERDR_GATEWAY_TOKEN is required when binding beyond loopback");
}

const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/pair", ["pair.html", "text/html; charset=utf-8"]],
  ["/pair.js", ["pair.js", "text/javascript; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/style.css", ["style.css", "text/css; charset=utf-8"]],
  ["/vendor/xterm.js", ["vendor/xterm.js", "text/javascript; charset=utf-8"]],
  ["/vendor/xterm.css", ["vendor/xterm.css", "text/css; charset=utf-8"]],
  ["/vendor/addon-fit.js", ["vendor/addon-fit.js", "text/javascript; charset=utf-8"]],
  ["/vendor/qrcode.js", ["vendor/qrcode.js", "text/javascript; charset=utf-8"]]
]);

function tokensEqual(provided) {
  if (!TOKEN) return true;
  const expected = Buffer.from(TOKEN);
  const actual = Buffer.from(typeof provided === "string" ? provided : "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function clampDimension(value, fallback, max) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.min(max, Math.max(10, number)) : fallback;
}

function send(ws, message) {
  if (ws.readyState === 1) ws.send(JSON.stringify(message));
}

function publicOrigin(request, url) {
  // Caddy terminates TLS and forwards to this loopback-only Bun listener over
  // HTTP. Accept the browser's public HTTPS origin only when the trusted local
  // proxy supplies a valid forwarded scheme; never accept an arbitrary value.
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto === "https" || forwardedProto === "http"
    ? forwardedProto
    : url.protocol.slice(0, -1);
  return `${protocol}://${url.host}`;
}

function deletePairing(ws) {
  const pairId = ws.data.pairId;
  if (pairId) pairings.delete(pairId);
  ws.data.pairId = null;
}

async function authenticate(ws) {
  deletePairing(ws);
  ws.data.authenticated = true;
  send(ws, { type: "ready", session: SESSION });
  await sendInventory(ws).catch((error) => send(ws, { type: "error", message: error.message }));
}

function createPairing(ws) {
  deletePairing(ws);
  const pairId = randomBytes(24).toString("base64url");
  const expiresAt = Date.now() + PAIRING_TTL_MS;
  ws.data.pairId = pairId;
  pairings.set(pairId, { ws, expiresAt });
  setTimeout(() => {
    const pairing = pairings.get(pairId);
    if (pairing?.expiresAt === expiresAt) {
      pairings.delete(pairId);
      if (pairing.ws.readyState === 1) {
        pairing.ws.data.pairId = null;
        send(pairing.ws, { type: "pair.expired" });
      }
    }
  }, PAIRING_TTL_MS + 1000);
  send(ws, { type: "pair.created", pairId, expiresAt });
}

function stopObserver(data) {
  data.observerGeneration += 1;
  if (data.observer) {
    data.observer.kill("SIGTERM");
    data.observer = null;
  }
}

async function consumeObserver(ws, process, generation) {
  const reader = process.stdout.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done || ws.data.observerGeneration !== generation) return;
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        try {
          const frame = JSON.parse(line);
          if (frame.type === "terminal.frame" && frame.encoding === "ansi") {
            send(ws, frame);
          }
        } catch {
          send(ws, { type: "error", message: "Herdr observer emitted malformed JSON" });
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function startObserver(ws, paneId, cols, rows) {
  const inventory = await herdr.inventory();
  if (!inventory.some((terminal) => terminal.paneId === paneId)) {
    throw new Error("Selected Herdr pane no longer exists");
  }

  stopObserver(ws.data);
  ws.data.selectedPaneId = paneId;
  ws.data.cols = clampDimension(cols, 100, 400);
  ws.data.rows = clampDimension(rows, 30, 200);
  const generation = ws.data.observerGeneration;

  const observer = Bun.spawn([
    HERDR_BIN,
    "--session", SESSION,
    "terminal", "session", "observe", paneId,
    "--cols", String(ws.data.cols),
    "--rows", String(ws.data.rows)
  ], {
    stdout: "pipe",
    stderr: "ignore",
    env: { ...process.env, HERDR_SOCKET_PATH: SOCKET_PATH }
  });

  ws.data.observer = observer;
  void consumeObserver(ws, observer, generation).catch((error) => {
    if (ws.data.observerGeneration === generation) {
      send(ws, { type: "error", message: `Herdr observer failed: ${error.message}` });
    }
  });
  void observer.exited.then((exitCode) => {
    if (ws.data.observerGeneration === generation && exitCode !== 0) {
      send(ws, { type: "error", message: "Herdr observer exited unexpectedly" });
    }
  });

  send(ws, { type: "terminal.selected", paneId, cols: ws.data.cols, rows: ws.data.rows });
}

async function sendInventory(ws) {
  send(ws, { type: "terminal.list", session: SESSION, terminals: await herdr.inventory() });
}

const server = Bun.serve({
  hostname: HOST,
  port: PORT,
  fetch(request, server) {
    const url = new URL(request.url);
    if (url.pathname === "/pair/submit" && request.method === "POST") {
      const origin = request.headers.get("origin");
      if (origin !== publicOrigin(request, url)) {
        return new Response("Forbidden", { status: 403 });
      }
      return request.json().then(async ({ pairId, token }) => {
        const pairing = pairings.get(typeof pairId === "string" ? pairId : "");
        if (!pairing || pairing.expiresAt < Date.now()) {
          if (pairing) pairings.delete(pairId);
          return new Response("Pairing has expired. Start a new one on the console.", { status: 410 });
        }
        if (!tokensEqual(token)) return new Response("Invalid gateway token", { status: 401 });
        if (pairing.ws.readyState !== 1) {
          pairings.delete(pairId);
          return new Response("Console is no longer connected", { status: 410 });
        }
        await authenticate(pairing.ws);
        return new Response(null, { status: 204 });
      }).catch(() => new Response("Expected JSON pairing request", { status: 400 }));
    }
    if (url.pathname === "/ws") {
      const origin = request.headers.get("origin");
      if (origin && origin !== publicOrigin(request, url)) {
        return new Response("Forbidden", { status: 403 });
      }
      const upgraded = server.upgrade(request, {
        data: {
          authenticated: false,
          selectedPaneId: null,
          cols: 100,
          rows: 30,
          observer: null,
          observerGeneration: 0,
          inputChain: Promise.resolve(),
          pairId: null
        }
      });
      return upgraded ? undefined : new Response("Upgrade failed", { status: 400 });
    }

    const asset = files.get(url.pathname);
    if (!asset) return new Response("Not found", { status: 404 });
    return new Response(Bun.file(join(WEB_ROOT, asset[0])), {
      headers: {
        "Content-Type": asset[1],
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer"
      }
    });
  },
  websocket: {
    maxPayloadLength: 65536,
    idleTimeout: 120,
    open(ws) {
      send(ws, { type: "auth.required", session: SESSION, tokenRequired: Boolean(TOKEN) });
    },
    async message(ws, rawMessage) {
      let message;
      try {
        message = JSON.parse(typeof rawMessage === "string" ? rawMessage : new TextDecoder().decode(rawMessage));
      } catch {
        send(ws, { type: "error", message: "Expected a JSON WebSocket message" });
        return;
      }

      if (!ws.data.authenticated) {
        if (message.type === "pair.create") {
          if (!TOKEN) {
            send(ws, { type: "error", message: "Phone pairing requires a gateway token" });
          } else {
            createPairing(ws);
          }
          return;
        }
        if (message.type !== "auth" || !tokensEqual(message.token)) {
          send(ws, { type: "auth.failed" });
          ws.close(1008, "Authentication failed");
          return;
        }
        await authenticate(ws);
        return;
      }

      try {
        switch (message.type) {
          case "list":
            await sendInventory(ws);
            break;
          case "select":
            await startObserver(ws, String(message.paneId ?? ""), message.cols, message.rows);
            break;
          case "resize":
            if (!ws.data.selectedPaneId) throw new Error("Select a terminal first");
            await startObserver(ws, ws.data.selectedPaneId, message.cols, message.rows);
            break;
          case "input": {
            if (!ws.data.selectedPaneId) throw new Error("Select a terminal first");
            if (typeof message.data !== "string" || Buffer.byteLength(message.data) > 16384) {
              throw new Error("Terminal input must be a string no larger than 16 KiB");
            }
            const paneId = ws.data.selectedPaneId;
            ws.data.inputChain = ws.data.inputChain.catch(() => {}).then(() =>
              herdr.request("pane.send_text", { pane_id: paneId, text: message.data })
            );
            await ws.data.inputChain;
            send(ws, { type: "input.accepted", byteLength: Buffer.byteLength(message.data) });
            break;
          }
          case "ping":
            send(ws, { type: "pong", at: Date.now() });
            break;
          default:
            throw new Error("Unsupported WebSocket message type");
        }
      } catch (error) {
        send(ws, { type: "error", message: error.message });
      }
    },
    close(ws) {
      deletePairing(ws);
      stopObserver(ws.data);
    }
  }
});

console.log(`BYD Herdr gateway listening on http://${HOST}:${server.port}`);
console.log(`Herdr session: ${SESSION}`);
console.log(`Herdr socket: ${SOCKET_PATH}`);
