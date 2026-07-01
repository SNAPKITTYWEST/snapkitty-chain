#!/usr/bin/env node
import { resolve } from "node:path";
import { Mempool } from "./mempool.mjs";
import { P2PNode } from "./p2p.mjs";
import { JsonRpcServer } from "./rpc.mjs";
import { SnapKittyChain } from "./chain.mjs";

const args = parseArgs(process.argv.slice(2));
const dataDir = resolve(args.data || ".snapkitty-chain");
const producer = args.producer || "SNAPKITTY-VALIDATOR";
const mempool = new Mempool();
const chain = new SnapKittyChain({
  dataDir,
  difficulty: Number(args.difficulty || 2),
  genesisProducer: producer
});

let p2p;

function produceBlock(source = "miner") {
  const result = chain.mineBlock(`${producer}:${source}`, mempool.sorted());
  if (result.ok) {
    mempool.removeMany(result.block.transactions.map((tx) => tx.hash));
    p2p?.broadcastBlock(result.block);
    log(`block ${result.block.height} ${result.block.hash.slice(0, 16)} txs=${result.block.transactions.length}`);
  } else {
    log(`block rejected ${result.reason}`);
  }
  return result;
}

function onTx(tx, remote = false) {
  const result = mempool.add(tx);
  if (result.accepted && !remote) p2p?.broadcastTx(result.tx);
  if (result.accepted) log(`tx ${result.tx.hash.slice(0, 16)} mempool=${mempool.size()}`);
  return result;
}

function onBlock(block) {
  const result = chain.acceptBlock(block);
  if (result.ok) {
    mempool.removeMany(block.transactions.map((tx) => tx.hash));
    log(`accepted peer block ${block.height} ${block.hash.slice(0, 16)}`);
  }
  return result;
}

p2p = new P2PNode({
  port: Number(args.p2p || 30333),
  chain,
  mempool,
  onBlock,
  onTx
});

const rpc = new JsonRpcServer({
  port: Number(args.rpc || 8545),
  chain,
  mempool,
  produceBlock,
  peers: () => p2p.peers()
});

await p2p.listen();
await rpc.listen();

for (const peer of arrayArg(args.peer)) {
  p2p.connect(peer);
}

log(`rpc=http://127.0.0.1:${args.rpc || 8545} p2p=127.0.0.1:${args.p2p || 30333}`);
log(`data=${dataDir}`);
log(`head=${chain.height()} ${chain.head().hash}`);

if (args.mine) {
  setInterval(() => {
    if (mempool.size() > 0 || args.emptyBlocks) produceBlock("miner");
  }, Number(args.blockTime || 5000));
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      out[key] = true;
    } else if (out[key]) {
      out[key] = Array.isArray(out[key]) ? [...out[key], next] : [out[key], next];
      i += 1;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function arrayArg(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function log(message) {
  console.log(`[SNAPKITTY-CHAIN] ${message}`);
}
