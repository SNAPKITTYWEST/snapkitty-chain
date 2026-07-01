#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createWallet, signTransaction } from "./crypto.mjs";

const [command, file, ...rest] = process.argv.slice(2);

if (command === "create") {
  const wallet = createWallet();
  const target = resolve(file || "wallet.json");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(wallet, null, 2)}\n`);
  console.log(wallet.address);
} else if (command === "sign") {
  const wallet = JSON.parse(readFileSync(resolve(file), "utf8"));
  const tx = JSON.parse(rest.join(" "));
  const signed = signTransaction(tx, wallet.privateKey);
  console.log(JSON.stringify(signed, null, 2));
} else {
  console.log("Usage:");
  console.log("  npm run wallet -- create ./.chain/wallets/aria.json");
  console.log("  npm run wallet -- sign ./.chain/wallets/aria.json '{\"to\":\"sk1...\",\"value\":\"1\",\"nonce\":0}'");
}
