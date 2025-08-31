/**
 * Data transformation utilities for server operations
 *
 * Handles conversion between different data formats (FormData, GraphQL input, Prisma operations)
 * following separation of concerns and single responsibility principles.
 */

import type {
  CreateServerFormData,
  UpdateServerFormData,
} from "@/lib/validators/schemas/server-schemas"

/**
 * Extracts form data into a typed object for validation
 * @param formData - The FormData from the form submission
 * @returns Object ready for schema validation
 */
export function extractFormDataForCreate(formData: FormData) {
  return {
    address: formData.get("address"),
    docker_host: formData.get("docker_host"),
    port: formData.get("port"),
    game: formData.get("game"),
    connection_type: formData.get("connection_type"),
    rconPassword: formData.get("rconPassword"),
  }
}

/**
 * Extracts form data into a typed object for validation (update variant)
 * @param formData - The FormData from the form submission
 * @returns Object ready for schema validation
 */
export function extractFormDataForUpdate(formData: FormData) {
  return {
    serverId: formData.get("serverId"),
    name: formData.get("name"),
    address: formData.get("address"),
    docker_host: formData.get("docker_host"),
    port: formData.get("port"),
    game: formData.get("game"),
    publicAddress: formData.get("publicAddress"),
    statusUrl: formData.get("statusUrl"),
    rconPassword: formData.get("rconPassword"),
    connection_type: formData.get("connection_type"),
    sortOrder: formData.get("sortOrder"),
  }
}

/**
 * Prepares GraphQL input for server creation
 * @param data - Validated form data
 * @returns GraphQL input object, cleaned of null/undefined values
 */
export function prepareCreateServerInput(data: CreateServerFormData) {
  const serverInput = {
    ...(data.connection_type === "docker"
      ? { dockerHost: data.docker_host }
      : { address: data.address }),
    port: data.port,
    game: data.game,
    connectionType: data.connection_type,
    // Only include rconPassword if it's provided
    ...(data.rconPassword && { rconPassword: data.rconPassword }),
  }

  // Clean up any undefined or null values that might cause GraphQL issues
  return Object.fromEntries(
    Object.entries(serverInput).filter(
      ([, value]) => value !== undefined && value !== null && value !== "",
    ),
  )
}

/**
 * Prepares Prisma field update operations input for server updates
 * @param data - Validated form data
 * @returns Prisma field update operations object
 */
export function prepareUpdateServerInput(
  data: UpdateServerFormData,
): Record<string, { set: string | number | null }> {
  const serverInput: Record<string, { set: string | number | null }> = {
    port: { set: data.port },
    game: { set: data.game },
    connectionType: { set: data.connection_type },
    sortOrder: { set: data.sortOrder },
  }

  // Handle connection type specific fields
  if (data.connection_type === "docker") {
    // For Docker servers, set dockerHost and clear address
    serverInput.dockerHost = { set: data.docker_host || "" }
    serverInput.address = { set: "" } // Set to empty string for Docker servers
  } else {
    // For external servers, set address and clear dockerHost
    serverInput.address = { set: data.address || "" }
    serverInput.dockerHost = { set: null } // Clear dockerHost for external servers
  }

  // Only include optional fields if they have values
  if (data.name && data.name.trim() !== "") {
    serverInput.name = { set: data.name.trim() }
  }
  if (data.publicAddress && data.publicAddress.trim() !== "") {
    serverInput.publicAddress = { set: data.publicAddress.trim() }
  }
  if (data.statusUrl && data.statusUrl.trim() !== "") {
    serverInput.statusUrl = { set: data.statusUrl.trim() }
  }
  if (data.rconPassword && data.rconPassword.trim() !== "") {
    serverInput.rconPassword = { set: data.rconPassword.trim() }
  }

  return serverInput
}
