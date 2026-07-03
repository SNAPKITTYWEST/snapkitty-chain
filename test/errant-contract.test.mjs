import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createWitness } from "../src/witness.mjs";
import { createZkProofEnvelope } from "../src/zk.mjs";
import { StellaFingerprintErrantContract } from "../src/errantContract.mjs";

test("ERRANT contract source contains the STELLA verifier rule", () => {
  const source = readFileSync("stellar-zk/errant/stella-fingerprint.errant", "utf8");
  assert.match(source, /contract STELLA_FINGERPRINT_V1/);
  assert.match(source, /fn verify_fingerprint/);
  assert.match(source, /noir_ultrahonk_verify/);
  assert.match(source, /emit stella_verified/);
});

test("ERRANT test fixture documents accept and reject cases", () => {
  const source = readFileSync("stellar-zk/errant/stella-fingerprint.test.errant", "utf8");
  assert.match(source, /accepts_valid_noir_envelope/);
  assert.match(source, /rejects_tampered_worm_hash/);
});

test("ERRANT devnet contract stores a valid STELLA receipt", () => {
  const witness = createWitness("prove sovereign fingerprint", [
    { stage: "TRUST-DEED-GATE", ok: true },
    { stage: "SEAL", worm_hash: "d".repeat(64) }
  ], "errant_contract_test");
  const proof = createZkProofEnvelope(witness);
  const contract = new StellaFingerprintErrantContract();

  const result = contract.verify_fingerprint({
    witness,
    proof,
    proof_words: [proof.proof_commitment]
  });

  assert.equal(result.ok, true);
  assert.equal(result.receipt.proof_hash, proof.proof_commitment);
  assert.deepEqual(contract.get_receipt(proof.proof_commitment), result.receipt);
  assert.equal(contract.events.at(-1).event, "stella_verified");
});

test("ERRANT devnet contract rejects tampered proof public signals", () => {
  const witness = createWitness("prove sovereign fingerprint", [
    { stage: "TRUST-DEED-GATE", ok: true },
    { stage: "SEAL", worm_hash: "e".repeat(64) }
  ], "errant_contract_reject_test");
  const proof = createZkProofEnvelope(witness);
  proof.public_signals.worm_hash = "f".repeat(64);
  const contract = new StellaFingerprintErrantContract();

  const result = contract.verify_fingerprint({
    witness,
    proof,
    proof_words: [proof.proof_commitment]
  });

  assert.equal(result.ok, false);
  assert.match(result.reason, /bad_public_signal/);
});
