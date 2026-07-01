import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify
} from "node:crypto";

export function sha256(value) {
  const input = typeof value === "string" ? value : stableStringify(value);
  return createHash("sha256").update(input).digest("hex");
}

export function stableStringify(value) {
  return JSON.stringify(normalize(value));
}

function normalize(value) {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;

  const out = {};
  for (const key of Object.keys(value).sort()) {
    if (value[key] !== undefined) out[key] = normalize(value[key]);
  }
  return out;
}

export function addressFromPublicKey(publicKeyPem) {
  return `sk1${sha256(publicKeyPem).slice(0, 40)}`;
}

export function createWallet() {
  const pair = generateKeyPairSync("ed25519");
  const publicKey = pair.publicKey.export({ type: "spki", format: "pem" });
  const privateKey = pair.privateKey.export({ type: "pkcs8", format: "pem" });
  return {
    address: addressFromPublicKey(publicKey),
    publicKey,
    privateKey
  };
}

export function txSigningPayload(tx) {
  const { signature, hash, receivedAt, ...payload } = tx;
  return stableStringify(payload);
}

export function signTransaction(tx, privateKeyPem) {
  const privateKey = createPrivateKey(privateKeyPem);
  const publicKey = createPublicKey(privateKey).export({ type: "spki", format: "pem" });
  const from = addressFromPublicKey(publicKey);
  const payload = { ...tx, from, publicKey };
  const signature = sign(null, Buffer.from(txSigningPayload(payload)), privateKey).toString("hex");
  const signed = { ...payload, signature };
  return { ...signed, hash: txHash(signed) };
}

export function verifyTransactionSignature(tx) {
  if (tx.from === "GENESIS") return true;
  if (!tx.publicKey || !tx.signature) return false;
  if (addressFromPublicKey(tx.publicKey) !== tx.from) return false;

  try {
    return verify(
      null,
      Buffer.from(txSigningPayload(tx)),
      createPublicKey(tx.publicKey),
      Buffer.from(tx.signature, "hex")
    );
  } catch {
    return false;
  }
}

export function txHash(tx) {
  const { hash, receivedAt, ...payload } = tx;
  return sha256(payload);
}

export function blockHeader(block) {
  const {
    hash,
    seal,
    consensusProof,
    transactions,
    ...header
  } = block;
  return Object.fromEntries(Object.entries(header).filter(([key]) => !key.startsWith("_")));
}

export function blockHash(block) {
  return sha256({
    ...blockHeader(block),
    txRoot: block.txRoot
  });
}

export function toHexQuantity(value) {
  return `0x${BigInt(value).toString(16)}`;
}

export function fromHexOrDecimal(value, fallback = 0n) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  const text = String(value);
  return text.startsWith("0x") ? BigInt(text) : BigInt(text);
}
