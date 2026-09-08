/**
 * Prints a short-lived token authorising one crawl.
 *
 *   INGEST_SECRET=... node scripts/mint-ingest-token.mjs [ttlMinutes]
 *
 * Safe to paste somewhere world-readable: it expires, and it cannot be used
 * to derive the secret it was signed with.
 */
import { mintToken } from "../src/lib/ingest/auth.ts";

const secret = process.env.INGEST_SECRET;
if (!secret) throw new Error("INGEST_SECRET is required");

const minutes = Number(process.argv[2] ?? 20);
console.log(mintToken(secret, minutes * 60 * 1000));
