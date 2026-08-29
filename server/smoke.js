import { homedir } from "node:os";
import { join } from "node:path";
import { HerdrSocketClient } from "./herdr-socket.js";

const session = process.env.HERDR_SESSION ?? "remote-tes";
const herdrBin = process.env.HERDR_BIN ?? join(homedir(), ".local/bin/herdr");
const socketPath = process.env.HERDR_SOCKET_PATH
  ?? join(homedir(), `.config/herdr/sessions/${session}/herdr.sock`);
const herdr = new HerdrSocketClient(socketPath);
const terminals = await herdr.inventory();

if (terminals.length === 0) throw new Error("No Herdr terminals found");
const selected = terminals.find((terminal) => terminal.agent) ?? terminals[0];
const observer = Bun.spawn([
  herdrBin,
  "--session", session,
  "terminal", "session", "observe", selected.paneId,
  "--cols", "100",
  "--rows", "30"
], { stdout: "pipe", stderr: "ignore" });

const reader = observer.stdout.getReader();
const timeout = setTimeout(() => observer.kill("SIGTERM"), 5000);
let output = "";
while (!output.includes("\n")) {
  const { done, value } = await reader.read();
  if (done) break;
  output += new TextDecoder().decode(value, { stream: true });
}
clearTimeout(timeout);
observer.kill("SIGTERM");
reader.releaseLock();

const firstLine = output.split("\n").find(Boolean);
if (!firstLine) throw new Error("Herdr observer closed without a frame");
const frame = JSON.parse(firstLine);
if (frame.type !== "terminal.frame" || frame.encoding !== "ansi" || !frame.bytes) {
  throw new Error("Herdr observer did not return an ANSI terminal frame");
}

// Exercise the exact writable socket method with an empty payload. This proves
// routing and authorization without altering the user's existing agent input.
await herdr.request("pane.send_text", { pane_id: selected.paneId, text: "" });

console.log(JSON.stringify({
  ok: true,
  session,
  terminalCount: terminals.length,
  selected: {
    paneId: selected.paneId,
    terminalId: selected.terminalId,
    agent: selected.agent,
    status: selected.status
  },
  frame: {
    seq: frame.seq,
    full: frame.full,
    width: frame.width,
    height: frame.height,
    encoding: frame.encoding,
    byteLength: Buffer.from(frame.bytes, "base64").length
  },
  inputRoute: "pane.send_text accepted an empty, non-mutating payload"
}, null, 2));
