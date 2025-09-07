/**
 * Authentication Service
 *
 * Handles user authentication using the crypto service for password verification.
 */

import type { ICryptoService } from "@repo/crypto"
import type { User } from "@repo/database/client"
import { AuthRepository } from "./auth.repository"

export class AuthService {
  private readonly authRepository: AuthRepository

  constructor(private readonly crypto: ICryptoService) {
    this.authRepository = new AuthRepository()
  }

  /**
   * Authenticate a user with username and password
   */
  async authenticate(username: string, password: string): Promise<User | null> {
    if (!username || !password) {
      throw new Error("Username and password are required")
    }

    // Find user by username
    const user = await this.authRepository.findUserByUsername(username)

    if (!user) {
      // Return null for non-existent users (don't reveal if user exists)
      return null
    }

    // Verify password using crypto service
    const isValidPassword = await this.crypto.verifyPassword(password, user.password)

    if (!isValidPassword) {
      return null
    }

    return user
  }

  /**
   * Create a new user account
   */
  async createUser(
    username: string,
    password: string,
    playerId?: number,
    acclevel: number = 0,
  ): Promise<User> {
    if (!username || !password) {
      throw new Error("Username and password are required")
    }

    if (username.length < 3 || username.length > 16) {
      throw new Error("Username must be between 3 and 16 characters")
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long")
    }

    // Check if username already exists
    const existingUser = await this.authRepository.findUserByUsername(username)

    if (existingUser) {
      throw new Error("Username already exists")
    }

    // Hash the password
    const hashedPassword = await this.crypto.hashPassword(password)

    // Create the user
    const newUser = await this.authRepository.createUser({
      username,
      password: hashedPassword,
      playerId,
      acclevel,
    })

    return newUser
  }

  /**
   * Update user password
   */
  async updatePassword(
    username: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<boolean> {
    if (!username || !oldPassword || !newPassword) {
      throw new Error("Username, old password, and new password are required")
    }

    if (newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long")
    }

    // Verify current password
    const user = await this.authenticate(username, oldPassword)
    if (!user) {
      throw new Error("Current password is incorrect")
    }

    // Hash the new password
    const hashedPassword = await this.crypto.hashPassword(newPassword)

    // Update the user's password
    await this.authRepository.updateUserPassword(username, hashedPassword)

    return true
  }

  /**
   * Reset user password (admin function)
   */
  async resetPassword(username: string, newPassword: string): Promise<boolean> {
    if (!username || !newPassword) {
      throw new Error("Username and new password are required")
    }

    if (newPassword.length < 6) {
      throw new Error("New password must be at least 6 characters long")
    }

    // Check if user exists
    const user = await this.authRepository.findUserByUsername(username)

    if (!user) {
      throw new Error("User not found")
    }

    // Hash the new password
    const hashedPassword = await this.crypto.hashPassword(newPassword)

    // Update the user's password
    await this.authRepository.updateUserPassword(username, hashedPassword)

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

    // Allow special characters but don't require them
    if (!/^[a-zA-Z0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]*$/.test(password)) {
      errors.push("Password contains invalid characters")
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Check if user has required access level
   */
  async checkAccess(username: string, requiredLevel: number): Promise<boolean> {
    const userAccessLevel = await this.authRepository.getUserAccessLevel(username)

    if (userAccessLevel === null) {
      return false
    }

    return userAccessLevel >= requiredLevel
  }
}
