import { txHash, verifyTransactionSignature } from "./crypto.mjs";

export class Mempool {
  constructor(maxSize = 5000) {
    this.maxSize = maxSize;
    this.txs = new Map();
    this.seen = new Set();
  }

  add(tx) {
    const normalized = { ...tx };
    normalized.hash = normalized.hash || txHash(normalized);
    normalized.receivedAt = normalized.receivedAt || Date.now();

    if (this.seen.has(normalized.hash)) {
      return { accepted: false, reason: "duplicate", tx: normalized };
    }

    if (!verifyTransactionSignature(normalized)) {
      return { accepted: false, reason: "bad_signature", tx: normalized };
    }

    if (this.txs.size >= this.maxSize) {
      const worst = this.sorted().at(-1);
      if (worst) this.remove(worst.hash);
    }

    this.txs.set(normalized.hash, normalized);
    this.seen.add(normalized.hash);
    return { accepted: true, tx: normalized };
  }

  remove(hash) {
    this.txs.delete(hash);
  }

  removeMany(hashes) {
    for (const hash of hashes) this.remove(hash);
  }

  sorted() {
    return [...this.txs.values()].sort((a, b) => {
      const gasDelta = BigInt(b.gasPrice || 0) - BigInt(a.gasPrice || 0);
      if (gasDelta > 0n) return 1;
      if (gasDelta < 0n) return -1;
      return (a.receivedAt || 0) - (b.receivedAt || 0);
    });
  }

  snapshot(limit = 100) {
    return this.sorted().slice(0, limit);
  }

  size() {
    return this.txs.size;
  }
}
