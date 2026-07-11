// anchor_mathlib5.mjs — Anchor the MATHLIB5 paper seals into SnapKitty Chain.
//
// Reads the crypto seals produced by paper/mathlib5/full/anchors/, builds a
// UnifiedWitness whose worm_hash is the MATHLIB5 source fingerprint, mines a
// block so the witness is anchored at a real chain height, and writes a
// settlement record. The WORM seal lives in .chain/mathlib5/chain.json.
//
// SnapKitty Collective · MATHLIB5 · 2026

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256, stableStringify, snapaddr } from "../src/witness.mjs";
import { SnapKittyChain } from "../src/chain.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANCHOR_DIR = join(
  __dirname,
  "..",
  "..",
  "paper",
  "mathlib5",
  "full",
  "anchors"
);

const read = (name) => readFileSync(join(ANCHOR_DIR, name), "utf8").trim();

const fingerprint = read("fingerprint.txt");
const opreturn = read("opreturn.txt");
const pubkey = read("pubkey.txt");
const signature = read("signature.txt");
const meta = JSON.parse(read("anchor_meta.json"));

const chain = new SnapKittyChain({
  dataDir: join(__dirname, "..", ".chain", "mathlib5"),
  chainId: 0x534b,
  difficulty: 2,
  genesisProducer: "MATHLIB5",
});

// Produce a block so the anchor references a settled height, not just genesis.
const mined = chain.mineBlock("MATHLIB5", []);
console.log(
  `mined block #${mined.block.height} hash=${mined.block.hash} seal=${mined.block.seal}`
);

const witness = {
  id: "wit_mathlib5_2026",
  session_id: "mathlib5-anchor",
  action: "MATHLIB5_PAPER_SEAL",
  verdict: "EVIDENCE",
  agent: "SNAPKITTY",
  worm_hash: fingerprint,
  sealed_at: new Date().toISOString(),
  payload: {
    title: "MATHLIB5 — Sovereign Math Engine: Architecture & Verified Pipeline",
    authors: ["Ahmad Ali Parr", "SnapKitty Collective"],
    orcid: "0009-0006-1916-5245",
    fingerprint_sha256: fingerprint,
    bitcoin_opreturn: opreturn,
    ed25519_pubkey: pubkey,
    ed25519_signature: signature,
    papers: meta.papers,
    sources: meta.sources,
    anchor_meta: meta,
  },
};
witness.snapaddr = snapaddr(witness);
witness.seal = sha256(stableStringify(witness));

const chainAnchor = chain.anchorWitness(witness);
console.log(
  `anchored witness height=${chainAnchor.height} block=${chainAnchor.block_hash} worm_seal=${chainAnchor.worm_seal}`
);

const settlement = {
  kind: "MATHLIB5_CHAIN_SETTLEMENT",
  witness,
  chain_anchor: chainAnchor,
  issued_at: new Date().toISOString(),
};
settlement.seal = sha256(stableStringify(settlement));

const outDir = ANCHOR_DIR;
mkdirSync(outDir, { recursive: true });
writeFileSync(
  join(outDir, "mathlib5_chain_settlement.json"),
  `${stableStringify(settlement)}\n`
);
writeFileSync(
  join(__dirname, "..", "mathlib5_anchor.json"),
  `${stableStringify(settlement)}\n`
);

console.log("settlement seal:", settlement.seal);
console.log("wrote: paper/mathlib5/full/anchors/mathlib5_chain_settlement.json");
console.log("wrote: snapkitty-chain/mathlib5_anchor.json");
