/**
 * Mock Crypto Service for Testing
 *
 * Provides a mock implementation of ICryptoService that can be used
 * in tests without requiring actual encryption/decryption operations.
 */

import type { ICryptoService } from "@repo/crypto"
import { vi } from "vitest"

export const createMockCryptoService = (): ICryptoService => ({
  /**
   * Mock encryption - returns predictable encrypted values for testing
   */
  encrypt: vi.fn().mockImplementation(async (plaintext: string) => {
    return `encrypted_${plaintext}`
  }),

  /**
   * Mock decryption - returns predictable decrypted values for testing
   */
  decrypt: vi.fn().mockImplementation(async (ciphertext: string) => {
    if (ciphertext.startsWith("encrypted_")) {
      return ciphertext.replace("encrypted_", "")
    }
    return "decrypted_data"
  }),
})
