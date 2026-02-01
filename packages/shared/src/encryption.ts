/**
 * Token encryption utilities using Web Crypto API (AES-GCM)
 * Compatible with Cloudflare Workers edge runtime
 *
 * Format: base64(salt + iv + ciphertext)
 * - salt: 16 bytes (random per encryption, used for PBKDF2 key derivation)
 * - iv: 12 bytes (random per encryption, used for AES-GCM)
 * - ciphertext: variable length
 */

const ALGORITHM = "AES-GCM";
const SALT_LENGTH = 16; // 128 bits for PBKDF2 salt
const IV_LENGTH = 12; // 96 bits for AES-GCM

/**
 * Derives a CryptoKey from the encryption secret and salt
 */
async function getKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a plaintext string using AES-GCM
 * Returns a base64-encoded string containing salt + IV + ciphertext
 */
export async function encryptToken(
  plaintext: string,
  encryptionSecret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const key = await getKey(encryptionSecret, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );

  // Combine salt + IV + ciphertext
  const combined = new Uint8Array(
    salt.length + iv.length + ciphertext.byteLength
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  // Encode as base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a base64-encoded encrypted string
 * Expects salt + IV + ciphertext format from encryptToken
 */
export async function decryptToken(
  encrypted: string,
  encryptionSecret: string
): Promise<string> {
  // Decode from base64
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));

  // Extract salt, IV, and ciphertext
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await getKey(encryptionSecret, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
}
