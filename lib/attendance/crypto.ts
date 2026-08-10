import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { parseAttendanceEmbeddingEnvironment } from "@/lib/env-schema";

const ivLength = 12;
const authTagLength = 16;

/** Encrypts a numeric face template with AES-256-GCM and appends its authentication tag. */
export function encryptEmbedding(embedding: number[], encodedKey?: string) {
  const key = getEmbeddingKey(encodedKey);
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(new Float32Array(embedding).buffer);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  return { ciphertext, iv, length: embedding.length };
}

/** Authenticates and decrypts a stored face template into finite numbers. */
export function decryptEmbedding(ciphertext: Uint8Array, iv: Uint8Array, length: number, encodedKey?: string) {
  if (ciphertext.length <= authTagLength || iv.length !== ivLength || length < 1) {
    throw new Error("Template wajah tersimpan tidak valid.");
  }
  const key = getEmbeddingKey(encodedKey);
  const payload = Buffer.from(ciphertext);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv));
  decipher.setAuthTag(payload.subarray(payload.length - authTagLength));
  const plaintext = Buffer.concat([decipher.update(payload.subarray(0, -authTagLength)), decipher.final()]);
  if (plaintext.byteLength !== length * Float32Array.BYTES_PER_ELEMENT) {
    throw new Error("Panjang template wajah tersimpan tidak sesuai.");
  }
  return Array.from(new Float32Array(plaintext.buffer, plaintext.byteOffset, length));
}

/** Creates a one-way SHA-256 representation for a single-use challenge nonce. */
export function hashAttendanceNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

/** Creates a cryptographically random nonce that is safe to return to the browser once. */
export function createAttendanceNonce() {
  return randomBytes(32).toString("base64url");
}

function getEmbeddingKey(encodedKey?: string) {
  if (encodedKey) {
    const key = Buffer.from(encodedKey, "base64");
    if (key.length !== 32) throw new Error("Kunci template wajah harus 32 byte.");
    return key;
  }
  return Buffer.from(parseAttendanceEmbeddingEnvironment(process.env).ATTENDANCE_EMBEDDING_KEY, "base64");
}
