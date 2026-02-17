/**
 * Authentication Service
 *
 * Handles user authentication using the crypto service for password verification.
 * Note: Primary authentication is now handled by Better Auth in the web app.
 * This service provides auxiliary auth utilities for the GraphQL API.
 */

import type { ICryptoService } from "@repo/crypto"
import type { User } from "@repo/db/client"
import { AuthRepository } from "./auth.repository"

export class AuthService {
  private readonly authRepository: AuthRepository

  constructor(private readonly crypto: ICryptoService) {
    this.authRepository = new AuthRepository()
  }

  /**
   * Authenticate a user with email and password
   * Checks the account table for credential-based passwords.
   */
  async authenticate(email: string, password: string): Promise<User | null> {
    if (!email || !password) {
      throw new Error("Email and password are required")
    }

    const user = await this.authRepository.findUserByEmail(email)
    if (!user) {
      return null
    }

    const account = await this.authRepository.findAccountCredential(user.id)
    if (!account?.password) {
      return null
    }

    const isValidPassword = await this.crypto.verifyPassword(password, account.password)
    if (!isValidPassword) {
      return null
    }

    return user
  }

  /**
   * Check if user has required role
   */
  async checkRole(email: string, requiredRole: string): Promise<boolean> {
    const role = await this.authRepository.getUserRole(email)
    if (!role) {
      return false
    }

    if (requiredRole === "admin") {
      return role === "admin"
    }

    return true
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (password.length < 6) {
      errors.push("Password must be at least 6 characters long")
    }

    if (password.length > 128) {
      errors.push("Password must be less than 128 characters long")
    }

    if (!/[a-z]/.test(password)) {
      errors.push("Password must contain at least one lowercase letter")
    }

    if (!/[A-Z]/.test(password)) {
      errors.push("Password must contain at least one uppercase letter")
    }

    if (!/[0-9]/.test(password)) {
      errors.push("Password must contain at least one number")
    }

    if (!/^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/.test(password)) {
      errors.push("Password contains invalid characters")
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}
