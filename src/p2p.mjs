import { createConnection, createServer } from "node:net";

export class P2PNode {
  constructor({ host = "127.0.0.1", port = 30333, chain, mempool, onBlock, onTx }) {
    this.host = host;
    this.port = port;
    this.chain = chain;
    this.mempool = mempool;
    this.onBlock = onBlock;
    this.onTx = onTx;
    this.sockets = new Set();
    this.server = createServer((socket) => this.attach(socket));
  }

  listen() {
    return new Promise((resolve) => {
      this.server.listen(this.port, this.host, () => resolve());
    });
  }

  connect(peer) {
    const [host, portText] = peer.split(":");
    const socket = createConnection({ host, port: Number(portText) }, () => {
      this.attach(socket);
    });
    socket.on("error", () => {});
  }

  attach(socket) {
    this.sockets.add(socket);
    socket.setEncoding("utf8");
    socket.write(`${JSON.stringify({ type: "hello", head: this.chain.head().hash, height: this.chain.height() })}\n`);

    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) this.handle(socket, line);
    });
    socket.on("close", () => this.sockets.delete(socket));
    socket.on("error", () => this.sockets.delete(socket));
  }

  handle(socket, line) {
    if (!line.trim()) return;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }

    if (msg.type === "hello") {
      socket.write(`${JSON.stringify({ type: "head", block: this.chain.head() })}\n`);
      return;
    }

    if (msg.type === "head" && msg.block) {
      this.onBlock(msg.block, true);
      return;
    }

    if (msg.type === "tx" && msg.tx) {
      this.onTx(msg.tx, true);
      return;
    }

    if (msg.type === "block" && msg.block) {
      this.onBlock(msg.block, true);
    }
  }

  broadcastTx(tx) {
    this.broadcast({ type: "tx", tx });
  }

  broadcastBlock(block) {
    this.broadcast({ type: "block", block });
  }

  broadcast(message) {
    const line = `${JSON.stringify(message)}\n`;
    for (const socket of this.sockets) {
      if (!socket.destroyed) socket.write(line);
    }
  }

  peers() {
    return [...this.sockets].map((socket) => `${socket.remoteAddress}:${socket.remotePort}`);
  }
}
