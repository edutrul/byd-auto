(() => {
  const status = document.querySelector("#status");
  const tokenInput = document.querySelector("#token");
  const connectButton = document.querySelector("#connect");
  const pairButton = document.querySelector("#pair");
  const newPairButton = document.querySelector("#new-pair");
  const pairPanel = document.querySelector("#pair-panel");
  const pairQr = document.querySelector("#pair-qr");
  const pairMessage = document.querySelector("#pair-message");
  const refreshButton = document.querySelector("#refresh");
  const terminalSelect = document.querySelector("#terminal-select");
  const fullscreenButton = document.querySelector("#fullscreen");
  const terminalPanel = document.querySelector("#terminal-panel");

  const terminal = new Terminal({
    cursorBlink: true, cursorStyle: "bar",
    fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 18, lineHeight: 1.18, scrollback: 5000, convertEol: false,
    theme: {
      background: "#02070d", foreground: "#dcefff", cursor: "#42c5ff", selectionBackground: "#245879",
      black: "#07111a", brightBlack: "#61788b", blue: "#43a9ff", brightBlue: "#75c4ff",
      cyan: "#31d7e9", brightCyan: "#82efff", green: "#42d392", brightGreen: "#78f3b9",
      red: "#ff657a", brightRed: "#ff9bab", yellow: "#f5c451", brightYellow: "#ffe18a"
    }
  });
  const fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(document.querySelector("#terminal"));
  fitAddon.fit();
  terminal.writeln("\x1b[1;36mBYD / HERDR TERMINAL\x1b[0m");
  terminal.writeln("Pair by phone, then select an existing terminal. No agent process will be started.");

  let socket;
  let resizeTimer;
  let pendingAction = null;

  function setStatus(label, state) {
    status.textContent = label;
    status.dataset.state = state;
  }

  function send(message) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }

  function sendSize(type) {
    fitAddon.fit();
    send({ type, cols: terminal.cols, rows: terminal.rows });
  }

  function decodeBase64(value) {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function renderTerminals(terminals) {
    terminalSelect.replaceChildren(new Option("Select an existing Herdr terminal", ""));
    for (const item of terminals) {
      const identity = item.agent ? item.agent.toUpperCase() : "TERMINAL";
      const title = item.title ? ` — ${item.title}` : "";
      terminalSelect.add(new Option(`${identity} · ${item.paneId} · ${item.status}${title}`, item.paneId));
    }
    terminalSelect.disabled = false;
    refreshButton.disabled = false;
  }

  function resetUi() {
    connectButton.disabled = false;
    pairButton.disabled = false;
    terminalSelect.disabled = true;
    refreshButton.disabled = true;
    terminalSelect.replaceChildren(new Option("Pair to list terminals", ""));
  }

  function renderQr(pairId, expiresAt) {
    const qr = qrcode(0, "M");
    qr.addData(`${location.origin}/pair#${pairId}`);
    qr.make();
    pairQr.innerHTML = qr.createSvgTag({ scalable: true, margin: 0 });
    const seconds = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    pairMessage.textContent = `Scan this code, enter the gateway token on your phone, then return here. Expires in ${seconds}s.`;
    pairPanel.hidden = false;
  }

  function runPendingAction() {
    if (pendingAction === "pair") {
      pendingAction = null;
      send({ type: "pair.create" });
    } else if (pendingAction === "manual") {
      pendingAction = null;
      send({ type: "auth", token: tokenInput.value });
    }
  }

  function openSocket(action) {
    pendingAction = action;
    if (socket?.readyState === WebSocket.OPEN) return runPendingAction();
    if (socket?.readyState === WebSocket.CONNECTING) return;
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${location.host}/ws`);
    connectButton.disabled = true;
    pairButton.disabled = true;
    setStatus("CONNECTING", "offline");

    socket.addEventListener("open", runPendingAction);
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case "ready":
          tokenInput.value = "";
          pairQr.replaceChildren();
          pairPanel.hidden = true;
          setStatus("ONLINE", "online");
          break;
        case "pair.created":
          renderQr(message.pairId, message.expiresAt);
          setStatus("AWAITING PHONE", "offline");
          connectButton.disabled = false;
          pairButton.disabled = false;
          break;
        case "pair.expired":
          pairQr.replaceChildren();
          pairMessage.textContent = "This code expired. Tap NEW QR to try again.";
          setStatus("PAIR EXPIRED", "offline");
          break;
        case "terminal.list":
          renderTerminals(message.terminals);
          break;
        case "terminal.frame":
          terminal.write(decodeBase64(message.bytes));
          break;
        case "terminal.selected":
          setStatus(message.paneId, "online");
          terminal.focus();
          break;
        case "auth.failed":
          setStatus("AUTH FAILED", "error");
          connectButton.disabled = false;
          pairButton.disabled = false;
          break;
        case "error":
          setStatus("ERROR", "error");
          terminal.writeln(`\r\n\x1b[31mGateway: ${message.message}\x1b[0m`);
          connectButton.disabled = false;
          pairButton.disabled = false;
          break;
      }
    });
    socket.addEventListener("close", () => {
      resetUi();
      setStatus("OFFLINE", "offline");
    });
    socket.addEventListener("error", () => setStatus("CONNECTION ERROR", "error"));
  }

  pairButton.addEventListener("click", () => openSocket("pair"));
  newPairButton.addEventListener("click", () => openSocket("pair"));
  connectButton.addEventListener("click", () => openSocket("manual"));
  refreshButton.addEventListener("click", () => send({ type: "list" }));
  terminalSelect.addEventListener("change", () => {
    if (!terminalSelect.value) return;
    terminal.reset();
    send({ type: "select", paneId: terminalSelect.value, cols: terminal.cols, rows: terminal.rows });
  });
  terminal.onData((data) => {
    if (terminalSelect.value) send({ type: "input", data });
  });

  fullscreenButton.addEventListener("click", async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await terminalPanel.requestFullscreen();
    setTimeout(() => sendSize("resize"), 80);
  });

  new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      fitAddon.fit();
      if (terminalSelect.value) sendSize("resize");
    }, 160);
  }).observe(terminalPanel);
})();
