import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const KEY_LENGTH = 32; // 256 bits for AES-256
const IV_LENGTH = 16; // 128 bits for CBC

/**
 * Derives a 256-bit key from a password using SHA-256
 */
function deriveKey(password: string): Buffer {
  return crypto.createHash("sha256").update(password).digest();
}

/**
 * Encrypts a string using AES-256-CBC
 * @param text - The plaintext to encrypt
 * @param password - The password to derive the encryption key from
 * @returns Base64-encoded encrypted string with IV prepended
 */
export function encrypt(text: string, password: string): string {
  const key = deriveKey(password);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  // Prepend IV to the encrypted text (IV is not secret and needed for decryption)
  return iv.toString("base64") + ":" + encrypted;
}

/**
 * Decrypts a string that was encrypted using the encrypt function
 * @param encryptedText - Base64-encoded encrypted string with IV prepended
 * @param password - The password to derive the decryption key from
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedText: string, password: string): string {
  const key = deriveKey(password);
  const parts = encryptedText.split(":");

  // Handle legacy CryptoJS format (base64 without IV prefix)
  // CryptoJS AES uses OpenSSL format: "Salted__" + salt + ciphertext
  if (parts.length === 1) {
    // This is likely a CryptoJS encrypted value
    // For backwards compatibility, try to decrypt using CryptoJS-compatible approach
    const encryptedBuffer = Buffer.from(encryptedText, "base64");

    // Check for OpenSSL "Salted__" header
    if (encryptedBuffer.slice(0, 8).toString("utf8") === "Salted__") {
      const salt = encryptedBuffer.slice(8, 16);
      const ciphertext = encryptedBuffer.slice(16);

      // Derive key and IV using OpenSSL's EVP_BytesToKey
      const derived = evpBytesToKey(password, salt, KEY_LENGTH, IV_LENGTH);
      const decipher = crypto.createDecipheriv(ALGORITHM, derived.key, derived.iv);
      let decrypted = decipher.update(ciphertext);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString("utf8");
    }

    throw new Error("Unable to decrypt: unrecognized format");
  }

  // New format with IV prefix
  const iv = Buffer.from(parts[0], "base64");
  const encrypted = parts[1];
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * OpenSSL's EVP_BytesToKey key derivation function
 * Used for backwards compatibility with CryptoJS
 */
function evpBytesToKey(password: string, salt: Buffer, keyLen: number, ivLen: number): { key: Buffer; iv: Buffer } {
  const totalLen = keyLen + ivLen;
  const result: Buffer[] = [];
  let prev = Buffer.alloc(0);

  while (Buffer.concat(result).length < totalLen) {
    const hash = crypto.createHash("md5");
    hash.update(prev);
    hash.update(password, "utf8");
    hash.update(salt);
    prev = hash.digest();
    result.push(prev);
  }

  const derived = Buffer.concat(result);
  return {
    key: derived.slice(0, keyLen),
    iv: derived.slice(keyLen, keyLen + ivLen),
  };
}
