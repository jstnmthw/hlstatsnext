/**
 * Shared Zod schemas for server validation
 *
 * Provides reusable schema components for server create/update operations
 * following DRY principles and consistent validation rules.
 */

import { z } from "zod"
import { isValidIPAddress } from "../server-validators"

/**
 * Base server field schemas - reusable components
 */
export const ServerFieldSchemas = {
  serverId: z.coerce.number().int().positive("Server ID is required"),

  name: z.string().max(255, "Name is too long").optional().or(z.null()),

  address: z
    .string()
    .min(1, "Server address is required")
    .max(15, "IP address is too long")
    .refine(isValidIPAddress, {
      message: "Please enter a valid IP address (e.g., 192.168.1.1)",
    })
    .optional()
    .or(z.null()),

  port: z.coerce
    .number()
    .int()
    .min(1, "Port must be greater than 0")
    .max(65535, "Port must be less than 65535"),

  game: z.string().optional().default("cstrike"),

  mod: z.string().optional().or(z.null()),

  publicAddress: z.string().max(128, "Public address is too long").optional().or(z.null()),

  statusUrl: z
    .string()
    .url("Please enter a valid URL")
    .max(255, "Status URL is too long")
    .optional()
    .or(z.literal(""))
    .or(z.null()),

  rconPassword: z.string().max(255, "RCON password is too long").optional().or(z.null()),

  sortOrder: z.coerce.number().int().min(0).max(127).optional().default(0),
}

/**
 * Schema for creating a new server
 */
export const CreateServerSchema = z.object({
  address: ServerFieldSchemas.address,
  port: ServerFieldSchemas.port,
  game: ServerFieldSchemas.game,
  mod: ServerFieldSchemas.mod,
  rconPassword: ServerFieldSchemas.rconPassword,
})

/**
 * Schema for updating an existing server
 */
export const UpdateServerSchema = z.object({
  serverId: ServerFieldSchemas.serverId,
  name: ServerFieldSchemas.name,
  address: ServerFieldSchemas.address,
  port: ServerFieldSchemas.port,
  game: ServerFieldSchemas.game,
  mod: ServerFieldSchemas.mod,
  publicAddress: ServerFieldSchemas.publicAddress,
  statusUrl: ServerFieldSchemas.statusUrl,
  rconPassword: ServerFieldSchemas.rconPassword,
  sortOrder: ServerFieldSchemas.sortOrder,
})

/**
 * Type definitions for form data
 */
export type CreateServerFormData = z.infer<typeof CreateServerSchema>
export type UpdateServerFormData = z.infer<typeof UpdateServerSchema>

/**
 * Common result type for server operations
 */
export type ServerOperationResult = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}
