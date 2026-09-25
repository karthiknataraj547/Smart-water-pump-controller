import { hash, verify, Options } from '@node-rs/argon2';

const ARGON2_OPTIONS: Options = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,       // 2 iterations
  parallelism: 1,
};

/**
 * Hash password securely using Argon2id
 */
export async function hashPassword(plainText: string): Promise<string> {
  return hash(plainText, ARGON2_OPTIONS);
}

/**
 * Verify plaintext password against Argon2id hash
 */
export async function verifyPassword(plainText: string, passwordHash: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plainText, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}
