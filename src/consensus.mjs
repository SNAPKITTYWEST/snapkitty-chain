import { createHmac, randomUUID } from "node:crypto";
import { sha256, stableStringify } from "./crypto.mjs";

export const CONSENSUS_AGENTS = ["ORACLE", "SENTINEL", "CIPHER", "AXIOM", "MNEMEX"];
export const CONSENSUS_ARCHITECTURE = "SACM-WORM-Causal-Validator-Mesh";
export const DEFAULT_QUORUM_RATIO = 0.6;

export function blockProposal(block) {
  return {
    chainId: block.chainId,
    height: block.height,
    prevHash: block.prevHash,
    producer: block.producer,
    txRoot: block.txRoot,
    stateRoot: block.stateRoot,
    gasUsed: block.gasUsed,
    baseFee: block.baseFee,
    difficulty: block.difficulty,
    cumulativeWork: block.cumulativeWork,
    txCount: block.transactions?.length || 0
  };
}

export function createConsensusProof(block, options = {}) {
  const secret = options.secret || "dev-sacm-chain-validator-key";
  const ratio = options.quorumRatio || DEFAULT_QUORUM_RATIO;
  const proposal = blockProposal(block);
  const proposalHash = sha256(proposal);
  const sealedAt = new Date(block.timestamp || Date.now()).toISOString();
  const consensusId = `sacm_cons_${randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const votes = CONSENSUS_AGENTS.map((agent, wormPosition) => {
    const result = evaluateAgent(agent, proposal);
    return {
      agent,
      vote: result.approved ? "approve" : "reject",
      rationale: result.rationale,
      wormPosition,
      signature: hmac(secret, `${agent}:${proposalHash}:${result.approved ? "approve" : "reject"}:${wormPosition}:${result.rationale}`)
    };
  });
  const approvalCount = votes.filter((vote) => vote.vote === "approve").length;
  const requiredQuorum = Math.ceil(CONSENSUS_AGENTS.length * ratio);
  const wormHash = hmac(secret, `${proposalHash}:${consensusId}:${votes.map((vote) => vote.signature).join(":")}`);
  const proofBase = {
    architecture: CONSENSUS_ARCHITECTURE,
    consensusId,
    proposalHash,
    votes,
    quorum: approvalCount >= requiredQuorum,
    approvalCount,
    requiredQuorum,
    wormHash,
    sealedAt
  };

  return {
    ...proofBase,
    masterSeal: {
      agent: "MNEMEX",
      timestamp: sealedAt,
      signature: hmac(secret, `MNEMEX:${proposalHash}:${wormHash}:${sealedAt}`)
    }
  };
}

export function verifyConsensusProof(block, proof, options = {}) {
  if (!proof || proof.architecture !== CONSENSUS_ARCHITECTURE) {
    return { ok: false, reason: "missing_consensus_proof" };
  }

  const secret = options.secret || "dev-sacm-chain-validator-key";
  const ratio = options.quorumRatio || DEFAULT_QUORUM_RATIO;
  const proposalHash = sha256(blockProposal(block));
  if (proof.proposalHash !== proposalHash) return { ok: false, reason: "bad_consensus_proposal_hash" };
  if (!Array.isArray(proof.votes) || proof.votes.length !== CONSENSUS_AGENTS.length) {
    return { ok: false, reason: "bad_consensus_vote_count" };
  }

  for (let i = 0; i < CONSENSUS_AGENTS.length; i += 1) {
    const vote = proof.votes[i];
    if (vote.agent !== CONSENSUS_AGENTS[i]) return { ok: false, reason: "bad_consensus_order" };
    if (vote.wormPosition !== i) return { ok: false, reason: "bad_consensus_worm_position" };
    const expected = hmac(secret, `${vote.agent}:${proposalHash}:${vote.vote}:${vote.wormPosition}:${vote.rationale}`);
    if (vote.signature !== expected) return { ok: false, reason: "bad_consensus_signature" };
  }

  const approvalCount = proof.votes.filter((vote) => vote.vote === "approve").length;
  const requiredQuorum = Math.ceil(CONSENSUS_AGENTS.length * ratio);
  const expectedWormHash = hmac(secret, `${proposalHash}:${proof.consensusId}:${proof.votes.map((vote) => vote.signature).join(":")}`);
  const expectedMaster = hmac(secret, `MNEMEX:${proposalHash}:${expectedWormHash}:${proof.sealedAt}`);

  if (proof.approvalCount !== approvalCount) return { ok: false, reason: "bad_consensus_approval_count" };
  if (proof.requiredQuorum !== requiredQuorum) return { ok: false, reason: "bad_consensus_required_quorum" };
  if (proof.quorum !== (approvalCount >= requiredQuorum)) return { ok: false, reason: "bad_consensus_quorum" };
  if (!proof.quorum) return { ok: false, reason: "consensus_silence" };
  if (proof.wormHash !== expectedWormHash) return { ok: false, reason: "bad_consensus_worm_hash" };
  if (proof.masterSeal?.signature !== expectedMaster) return { ok: false, reason: "bad_consensus_master_seal" };

  return { ok: true, reason: "consensus_evidence" };
}

export function consensusRoot(proof) {
  return sha256({
    architecture: proof.architecture,
    consensusId: proof.consensusId,
    proposalHash: proof.proposalHash,
    wormHash: proof.wormHash,
    masterSeal: proof.masterSeal
  });
}

function evaluateAgent(agent, proposal) {
  const hash64 = (value) => typeof value === "string" && /^[0-9a-f]{64}$/i.test(value);
  const gas = BigInt(proposal.gasUsed || "0");

  switch (agent) {
    case "ORACLE":
      return {
        approved: Number.isInteger(proposal.chainId) && proposal.height > 0 && hash64(proposal.prevHash),
        rationale: "Chain identity, height, and parent hash are present"
      };
    case "SENTINEL":
      return {
        approved: proposal.txCount <= 200 && gas <= 30_000_000n,
        rationale: `Block load within validator policy: txCount=${proposal.txCount}, gas=${gas}`
      };
    case "CIPHER":
      return {
        approved: hash64(proposal.txRoot) && hash64(proposal.stateRoot),
        rationale: "Transaction root and state root are SHA-256 digests"
      };
    case "AXIOM":
      return {
        approved: proposal.difficulty >= 1 && proposal.cumulativeWork > 0,
        rationale: "Proof-of-work difficulty and cumulative work are non-zero"
      };
    case "MNEMEX":
      return {
        approved: Boolean(proposal.producer) && typeof proposal.baseFee === "string",
        rationale: "Producer and fee memory anchors are present"
      };
    default:
      return { approved: false, rationale: "Unknown validator" };
  }
}

function hmac(secret, message) {
  return createHmac("sha256", secret).update(stableStringify(message)).digest("hex");
}
