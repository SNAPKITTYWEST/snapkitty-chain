# SnapKitty Chain

Sovereign peer-to-peer blockchain devnet for the SnapKitty stack.

This is the missing layer the NOVA repos did not yet contain: validator/miner node software, consensus, mempool, block production, fork choice, native gas/token economics, and wallet-style JSON-RPC.

## What Already Existed In SNAPKITTYAGENT9NOVA

- `forge-token`: FORGE token contracts and tokenomics on an existing chain.
- `sealforge`: WORM-sealed AI decision ledger and bridge logic.
- `webhook-vault`: WORM-sealed webhook inspector.
- `snapkitty-collective`: sovereign infrastructure docs/site.

Those are token, ledger, and app-layer pieces. `snapkitty-chain` is the actual chain node.

## Features

- P2P node over TCP newline JSON gossip.
- Mempool with nonce checks and gas-price ordering.
- Proof-of-work block production.
- SACM validator proof on every produced block: ORACLE, SENTINEL, CIPHER, AXIOM, MNEMEX.
- Fork choice by cumulative work, with deterministic hash tie-break.
- Native gas token: `FRG`.
- WORM-sealed append-only block events.
- JSON-RPC endpoint with Ethereum-style read methods and SnapKitty write methods.
- Ed25519 local wallet generation/signing, no external dependencies.
- Persistent chain/state/worm files under the node data directory.
- Self-contained Web3 console: `web3-console.html`.

## Quick Start

Start node 1:

```powershell
cd C:\Users\jessi\Desktop\snapkitty-chain
npm test
npm run node -- --data .\.chain\node1 --rpc 8545 --p2p 30333 --mine --producer CARTO
```

Start node 2 in a second terminal:

```powershell
cd C:\Users\jessi\Desktop\snapkitty-chain
npm run node -- --data .\.chain\node2 --rpc 8546 --p2p 30334 --peer 127.0.0.1:30333 --mine --producer NOVA
```

Create a wallet:

```powershell
npm run wallet -- create .\.chain\wallets\aria.json
```

Fund it on node 1:

```powershell
$addr = (Get-Content .\.chain\wallets\aria.json | ConvertFrom-Json).address
$body = @{jsonrpc="2.0";id=1;method="sk_faucet";params=@($addr,"1000000000000000000")} | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8545 -Method Post -ContentType application/json -Body $body
```

Check balance:

```powershell
$body = @{jsonrpc="2.0";id=2;method="eth_getBalance";params=@($addr,"latest")} | ConvertTo-Json
Invoke-RestMethod -Uri http://127.0.0.1:8545 -Method Post -ContentType application/json -Body $body
```

## JSON-RPC

Ethereum-style compatibility surface:

- `web3_clientVersion`
- `net_version`
- `eth_chainId`
- `eth_blockNumber`
- `eth_getBalance`
- `eth_getBlockByNumber`
- `eth_getBlockByHash`
- `eth_sendRawTransaction`

SnapKitty native methods:

- `sk_sendTransaction`
- `sk_faucet`
- `sk_getMempool`
- `sk_produceBlock`
- `sk_getWorm`
- `sk_getPeers`
- `sk_getValidators`
- `sk_getConsensusProof`

`eth_sendRawTransaction` accepts either a JSON transaction object or a hex-encoded JSON transaction string. Real browser wallet signing compatibility is the next step; the node already exposes wallet-shaped JSON-RPC, but the native cryptography is Ed25519 instead of Ethereum secp256k1.

## Native Economics

- Native token: `FRG`
- Gas charged per transaction: `gasLimit * gasPrice`
- Block producer receives all transaction fees plus the block reward.
- Default block reward: `5 FRG`
- Faucet is devnet-only and WORM logged.

## Consensus

The devnet uses simple WORM-PoW:

1. Build candidate block from the mempool.
2. Apply transactions against local state.
3. Compute tx root and state root.
4. Run the SACM validator mesh: ORACLE, SENTINEL, CIPHER, AXIOM, MNEMEX.
5. Store quorum evidence as `consensusProof` and commit its digest as `consensusRoot`.
6. Increment nonce until the block hash has the required leading zero prefix.
7. Gossip the block to peers.

Fork choice:

1. Highest cumulative work wins.
2. If cumulative work ties, lowest block hash wins.
3. Blocks with invalid parent, invalid proof, invalid gas, bad nonce, or bad signatures are rejected.

## Web3 Console

Start the node, then open:

```text
C:\Users\jessi\Desktop\snapkitty-chain\web3-console.html
```

The console talks directly to `http://127.0.0.1:8545` and shows chain height, validators, latest block, WORM seals, faucet, and manual block production.

## License

Apache-2.0
