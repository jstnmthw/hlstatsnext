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

  dockerHost: z
    .string()
    .min(1, "Docker host is required")
    .max(255, "Docker host is too long")
    .optional()
    .or(z.null()),

  port: z.coerce
    .number()
    .int()
    .min(1, "Port must be greater than 0")
    .max(65535, "Port must be less than 65535"),

  game: z.string().optional().default("cstrike"),

  publicAddress: z.string().max(128, "Public address is too long").optional().or(z.null()),

  statusUrl: z
    .string()
    .url("Please enter a valid URL")
    .max(255, "Status URL is too long")
    .optional()
    .or(z.literal(""))
    .or(z.null()),

  rconPassword: z.string().max(255, "RCON password is too long").optional().or(z.null()),

  connectionType: z.enum(["external", "docker"]).optional().default("external"),

  sortOrder: z.coerce.number().int().min(0).max(127).optional().default(0),
}

/**
 * Shared validation logic for connection type requirements
 */
export const connectionTypeRefine = (
  data: { connection_type?: string; address?: string | null; docker_host?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (data.connection_type === "docker") {
    if (!data.docker_host || data.docker_host.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Docker host is required for Docker connection type",
        path: ["docker_host"],
      })
    }
  } else {
    if (!data.address || data.address.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Server address is required for external connection type",
        path: ["address"],
      })
    }
  }
}

/**
 * Schema for creating a new server
 */
export const CreateServerSchema = z
  .object({
    address: ServerFieldSchemas.address,
    docker_host: ServerFieldSchemas.dockerHost,
    port: ServerFieldSchemas.port,
    game: ServerFieldSchemas.game,
    connection_type: ServerFieldSchemas.connectionType,
    rconPassword: ServerFieldSchemas.rconPassword,
  })
  .superRefine(connectionTypeRefine)

/**
 * Schema for updating an existing server
 */
export const UpdateServerSchema = z
  .object({
    serverId: ServerFieldSchemas.serverId,
    name: ServerFieldSchemas.name,
    address: ServerFieldSchemas.address,
    docker_host: ServerFieldSchemas.dockerHost,
    port: ServerFieldSchemas.port,
    game: ServerFieldSchemas.game,
    publicAddress: ServerFieldSchemas.publicAddress,
    statusUrl: ServerFieldSchemas.statusUrl,
    rconPassword: ServerFieldSchemas.rconPassword,
    connection_type: ServerFieldSchemas.connectionType,
    sortOrder: ServerFieldSchemas.sortOrder,
  })
  .superRefine(connectionTypeRefine)

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
