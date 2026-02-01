/**
 * Encryption utilities for storing sensitive data like OAuth tokens.
 * Uses AES-GCM with PBKDF2 key derivation for Cloudflare edge runtime compatibility.
 */

const ALGORITHM = "AES-GCM";
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 256;
const PBKDF2_ITERATIONS = 100000;

/**
 * Derives a cryptographic key from a password using PBKDF2.
 */
async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts a token using AES-GCM with a derived key.
 * Returns a base64 string containing: salt (16 bytes) + iv (12 bytes) + ciphertext
 */
export async function encryptToken(
  token: string,
  encryptionSecret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(encryptionSecret, salt);

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(token)
  );

  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(
    salt.length + iv.length + new Uint8Array(ciphertext).length
  );
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

  // Convert to base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts a token that was encrypted with encryptToken.
 */
export async function decryptToken(
  encryptedToken: string,
  encryptionSecret: string
): Promise<string> {
  // Convert from base64
  const combined = new Uint8Array(
    atob(encryptedToken)
      .split("")
      .map((c) => c.charCodeAt(0))
  );

  // Extract salt, iv, and ciphertext
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(encryptionSecret, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
