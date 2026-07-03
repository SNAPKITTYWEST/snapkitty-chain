// errantContract.mjs — executable test harness for STELLA ERRANT contract
//
// This is not the ERRANT compiler. It is the deterministic devnet adapter for
// the ERRANT contract semantics in stellar-zk/errant/stella-fingerprint.errant.

import { verifyZkProofEnvelope } from "./zk.mjs";
import { sha256, stableStringify } from "./witness.mjs";

export class StellaFingerprintErrantContract {
  constructor() {
    this.receipts = new Map();
    this.events = [];
  }

  verify_fingerprint({ witness, proof, proof_words = [] }) {
    if (!Array.isArray(proof_words) || proof_words.length === 0) {
      return { ok: false, reason: "empty_proof_words" };
    }

    const verification = verifyZkProofEnvelope(witness, proof);
    if (!verification.ok) return verification;

    const receipt = {
      public_fingerprint: proof.public_signals.public_fingerprint,
      proof_hash: proof.proof_commitment,
      snapaddr_hash: proof.public_signals.snapaddr_hash,
      worm_hash: proof.public_signals.worm_hash,
      verdict_hash: proof.public_signals.verdict_hash,
      action_hash: proof.public_signals.action_hash,
    };
    receipt.receipt_hash = sha256(stableStringify(receipt));

    this.receipts.set(receipt.proof_hash, receipt);
    this.events.push({
      event: "stella_verified",
      public_fingerprint: receipt.public_fingerprint,
      proof_hash: receipt.proof_hash,
      receipt_hash: receipt.receipt_hash,
    });

    return { ok: true, reason: "errant_contract_verified", receipt };
  }

  get_receipt(proof_hash) {
    return this.receipts.get(proof_hash) || null;
  }
}
