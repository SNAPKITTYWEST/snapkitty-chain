# Cosmic Invariant Sieve — Sovereign WORM-Chain NFT Collection

Canonical, on-chain-ready registry for the SnapKitty NFT collection described
in the academic paper *SnapKitty Sovereign Compute Architecture*
(Section 17 — Cosmic Invariant Sieve; Section 18.7 — Sovereign WORM-Chain
NFT Collection).

This directory is the **minted registry**: the artifacts below are published
as the collection's authoritative state. Attaching an on-chain Ed25519
signature through a running `snapkitty-chain` node is a separate, gated step
(see the paper, §18.6 — the cryptographic seal bound is distinct from
logical-witness error).

## Contents

- `worm_glitch.rs` — pure-Rust generator, **no external dependencies**.
  Build: `rustc worm_glitch.rs -O -o worm_glitch`
- `worm_chain.json` — the 9-link append-only SHA-256 WORM chain.
- `collection.json` — ERC-721-style metadata for the whole collection
  (cover image as a data URI; per-link items carrying worm prev/tip hashes
  and the seven recurring invariants).
- `cover.svg` — glitch art embedded as the *front* of the worm.
- `glitch_00.svg` … `glitch_08.svg` — per-link glitch art.

## Collection facts

- **Name:** Cosmic Invariant Sieve — WORM Chain
- **Links:** 9 (indices 0–8)
- **Chain tip (last SHA-256):**
  `21b9bde5691a8fb912a429f5691f595936491f307ce2da05648ab8919683e606`
- Each link binds: the previous link's hash + the seven recurring invariants
  (normalization, ownership, provenance, append-only history, bounded effects,
  deterministic verification, failure closure) + a procedurally generated
  glitch-art SVG.
- **Signature field:** `ed25519:<pending-mint>` until signed on-chain.

## Reproduce

```bash
rustc worm_glitch.rs -O -o worm_glitch
./worm_glitch 9 nft_out
```

Emits `worm_chain.json`, `collection.json`, `cover.svg`, and `glitch_*.svg`
into `nft_out/`.
