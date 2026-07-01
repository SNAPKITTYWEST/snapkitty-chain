import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SnapKittyChain } from "../src/chain.mjs";
import { createWallet, signTransaction } from "../src/crypto.mjs";
import { Mempool } from "../src/mempool.mjs";

test("faucet credits native FRG balance and WORM seals it", () => {
  const chain = new SnapKittyChain();
  const wallet = createWallet();
  const result = chain.faucet(wallet.address, "1000");

  assert.equal(chain.getBalance(wallet.address), 1000n);
  assert.equal(result.seal.length, 64);
  assert.equal(chain.worm.at(-1).kind, "FAUCET");
});

test("signed tx enters mempool and mines into a valid block", () => {
  const chain = new SnapKittyChain({ difficulty: 1 });
  const sender = createWallet();
  const receiver = createWallet();
  chain.faucet(sender.address, "1000000000000000000");

  const tx = signTransaction({
    to: receiver.address,
    value: "100",
    gasLimit: "21000",
    gasPrice: "1",
    nonce: 0,
    data: "test transfer"
  }, sender.privateKey);

  const mempool = new Mempool();
  const added = mempool.add(tx);
  assert.equal(added.accepted, true);

  const mined = chain.mineBlock("CARTO", mempool.sorted());
  assert.equal(mined.ok, true);
  assert.equal(chain.height(), 1);
  assert.equal(chain.getBalance(receiver.address), 100n);
  assert.equal(chain.getNonce(sender.address), 1);
  assert.equal(mined.block.consensusProof.quorum, true);
  assert.equal(mined.block.consensusProof.approvalCount, 5);
  assert.equal(mined.block.consensusRoot.length, 64);
});

test("bad nonce transaction is rejected by block validation", () => {
  const chain = new SnapKittyChain({ difficulty: 1 });
  const sender = createWallet();
  const receiver = createWallet();
  chain.faucet(sender.address, "1000000000000000000");

  const tx = signTransaction({
    to: receiver.address,
    value: "100",
    gasLimit: "21000",
    gasPrice: "1",
    nonce: 2
  }, sender.privateKey);

  const mined = chain.mineBlock("NOVA", [tx]);
  assert.equal(mined.ok, true);
  assert.equal(mined.block.transactions.length, 0);
  assert.equal(mined.rejected[0].reason, "bad_nonce");
});

test("chain persists and reloads state", () => {
  const dir = mkdtempSync(join(tmpdir(), "snapkitty-chain-"));
  try {
    const chain = new SnapKittyChain({ dataDir: dir, difficulty: 1 });
    const wallet = createWallet();
    chain.faucet(wallet.address, "999");

    const reloaded = new SnapKittyChain({ dataDir: dir });
  assert.equal(reloaded.getBalance(wallet.address), 999n);
  assert.equal(reloaded.head().hash, chain.head().hash);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("consensus proof tampering rejects a peer block", () => {
  const chain = new SnapKittyChain({ difficulty: 1 });
  const mined = chain.mineBlock("AXIOM", []);
  assert.equal(mined.ok, true);

  const peer = new SnapKittyChain({ difficulty: 1 });
  const tampered = structuredClone(mined.block);
  tampered.consensusProof.votes[0].vote = "reject";

  const accepted = peer.acceptBlock(tampered);
  assert.equal(accepted.ok, false);
  assert.equal(accepted.reason, "bad_consensus_signature");
});
