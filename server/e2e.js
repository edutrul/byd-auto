const token = process.env.HERDR_GATEWAY_TOKEN ?? "";
const url = process.env.HERDR_GATEWAY_URL ?? "ws://127.0.0.1:8790/ws";

function runConnection(paneId = null) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      socket.close();
      fail(new Error("Gateway WebSocket test timed out"));
    }, 8000);
    const socket = new WebSocket(url);
    let selectedPaneId = paneId;
    let frame;
    let inputAccepted = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      reject(error);
    };

    const finish = () => {
      if (settled || !frame || !inputAccepted) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      resolve({ paneId: selectedPaneId, frame });
    };

    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "auth", token }));
    });
    socket.addEventListener("error", () => fail(new Error("Gateway WebSocket connection failed")));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.type === "auth.failed" || message.type === "error") {
        fail(new Error(message.message ?? message.type));
        return;
      }
      if (message.type === "terminal.list" && !selectedPaneId) {
        selectedPaneId = message.terminals.find((terminal) => terminal.agent)?.paneId
          ?? message.terminals[0]?.paneId;
        if (!selectedPaneId) {
          fail(new Error("Gateway returned no terminals"));
          return;
        }
        socket.send(JSON.stringify({ type: "select", paneId: selectedPaneId, cols: 100, rows: 30 }));
      } else if (message.type === "terminal.list" && selectedPaneId) {
        socket.send(JSON.stringify({ type: "select", paneId: selectedPaneId, cols: 100, rows: 30 }));
      } else if (message.type === "terminal.frame" && !frame) {
        frame = {
          seq: message.seq,
          full: message.full,
          width: message.width,
          height: message.height,
          bytes: Buffer.from(message.bytes, "base64").length
        };
        socket.send(JSON.stringify({ type: "input", data: "" }));
      } else if (message.type === "input.accepted") {
        inputAccepted = message.byteLength === 0;
        finish();
      }
    });
  });
}

const first = await runConnection();
const reconnected = await runConnection(first.paneId);

if (!first.frame.full || !reconnected.frame.full) {
  throw new Error("Expected a full bootstrap frame on initial connect and reconnect");
}

console.log(JSON.stringify({
  ok: true,
  url,
  paneId: first.paneId,
  firstConnection: first.frame,
  reconnect: reconnected.frame,
  inputRoute: "WebSocket input acknowledged through Herdr pane.send_text"
}, null, 2));
