(() => {
  const status = document.querySelector("#status");
  const tokenInput = document.querySelector("#token");
  const connectButton = document.querySelector("#connect");
  const refreshButton = document.querySelector("#refresh");
  const terminalSelect = document.querySelector("#terminal-select");
  const fullscreenButton = document.querySelector("#fullscreen");
  const terminalPanel = document.querySelector("#terminal-panel");

  const terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: "bar",
    fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 18,
    lineHeight: 1.18,
    scrollback: 5000,
    convertEol: false,
    theme: {
      background: "#02070d",
      foreground: "#dcefff",
      cursor: "#42c5ff",
      selectionBackground: "#245879",
      black: "#07111a",
      brightBlack: "#61788b",
      blue: "#43a9ff",
      brightBlue: "#75c4ff",
      cyan: "#31d7e9",
      brightCyan: "#82efff",
      green: "#42d392",
      brightGreen: "#78f3b9",
      red: "#ff657a",
      brightRed: "#ff9bab",
      yellow: "#f5c451",
      brightYellow: "#ffe18a"
    }
  });
  const fitAddon = new FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(document.querySelector("#terminal"));
  fitAddon.fit();
  terminal.writeln("\x1b[1;36mEDUARDO / HERDR TERMINAL GATEWAY\x1b[0m");
  terminal.writeln("Connect, then select an existing terminal. No agent process will be started.");

  let socket;
  let resizeTimer;

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

  connectButton.addEventListener("click", () => {
    socket?.close();
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    socket = new WebSocket(`${protocol}//${location.host}/ws`);
    connectButton.disabled = true;
    setStatus("CONNECTING", "offline");

    socket.addEventListener("open", () => send({ type: "auth", token: tokenInput.value }));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      switch (message.type) {
        case "ready":
          tokenInput.value = "";
          setStatus("ONLINE", "online");
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
          break;
        case "error":
          setStatus("ERROR", "error");
          terminal.writeln(`\r\n\x1b[31mGateway: ${message.message}\x1b[0m`);
          break;
      }
    });
    socket.addEventListener("close", () => {
      connectButton.disabled = false;
      terminalSelect.disabled = true;
      refreshButton.disabled = true;
      setStatus("OFFLINE", "offline");
    });
    socket.addEventListener("error", () => setStatus("CONNECTION ERROR", "error"));
  });

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

