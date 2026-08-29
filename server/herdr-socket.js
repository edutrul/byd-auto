export class HerdrSocketClient {
  constructor(socketPath, timeoutMs = 5000) {
    this.socketPath = socketPath;
    this.timeoutMs = timeoutMs;
  }

  request(method, params = {}) {
    const id = `byd-${crypto.randomUUID()}`;

    return new Promise((resolve, reject) => {
      const decoder = new TextDecoder();
      let buffer = "";
      let settled = false;
      let socket;

      const finish = (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          socket?.end();
        } catch {
          // The server may already have closed a one-shot request socket.
        }
        error ? reject(error) : resolve(result);
      };

      const timer = setTimeout(() => {
        finish(new Error(`Herdr ${method} timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      Bun.connect({
        unix: this.socketPath,
        socket: {
          open(openSocket) {
            socket = openSocket;
            openSocket.write(`${JSON.stringify({ id, method, params })}\n`);
          },
          data(_socket, chunk) {
            buffer += decoder.decode(chunk, { stream: true });
            let newline;
            while ((newline = buffer.indexOf("\n")) !== -1) {
              const line = buffer.slice(0, newline).trim();
              buffer = buffer.slice(newline + 1);
              if (!line) continue;

              let message;
              try {
                message = JSON.parse(line);
              } catch {
                finish(new Error("Herdr returned malformed JSON"));
                return;
              }

              if (message.id !== id) continue;
              if (message.error) {
                finish(new Error(`${message.error.code}: ${message.error.message}`));
                return;
              }
              finish(null, message.result);
              return;
            }
          },
          error(_socket, error) {
            finish(new Error(`Herdr socket error: ${error.message}`));
          },
          close() {
            if (!settled) finish(new Error("Herdr socket closed before responding"));
          }
        }
      }).catch((error) => finish(new Error(`Cannot connect to Herdr: ${error.message}`)));
    });
  }

  async inventory() {
    const [paneResult, agentResult] = await Promise.all([
      this.request("pane.list", {}),
      this.request("agent.list", {})
    ]);

    const agentsByPane = new Map(
      (agentResult.agents ?? []).map((agent) => [agent.pane_id, agent])
    );

    return (paneResult.panes ?? [])
      .filter((pane) => pane.pane_id && pane.terminal_id)
      .map((pane) => {
        const agent = agentsByPane.get(pane.pane_id);
        return {
          paneId: pane.pane_id,
          terminalId: pane.terminal_id,
          agent: agent?.agent ?? pane.agent ?? null,
          status: agent?.agent_status ?? pane.agent_status ?? "unknown",
          title: agent?.terminal_title_stripped ?? pane.terminal_title_stripped ?? pane.label ?? null,
          focused: Boolean(pane.focused)
        };
      });
  }
}
