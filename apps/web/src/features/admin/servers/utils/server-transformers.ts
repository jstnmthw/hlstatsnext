/**
 * Data transformation utilities for server operations
 *
 * Handles conversion between different data formats (FormData, GraphQL input, Prisma operations)
 * following separation of concerns and single responsibility principles.
 */

import type { CreateServerFormData } from "@/features/admin/servers/actions/create-server"
import type { UpdateServerFormData } from "@/features/admin/servers/actions/update-server"
import type { CreateServerInput } from "@/lib/gql/graphql"

/**
 * Extracts form data into a typed object for validation
 * @param formData - The FormData from the form submission
 * @returns Object ready for schema validation
 */
export function extractFormDataForCreate(formData: FormData) {
  return {
    address: formData.get("address"),
    port: formData.get("port"),
    game: formData.get("game"),
    mod: formData.get("mod"),
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
    port: formData.get("port"),
    game: formData.get("game"),
    mod: formData.get("mod"),
    publicAddress: formData.get("publicAddress"),
    statusUrl: formData.get("statusUrl"),
    rconPassword: formData.get("rconPassword"),
    sortOrder: formData.get("sortOrder"),
  }
}

/**
 * Prepares GraphQL input for server creation
 * @param data - Validated form data
 * @returns GraphQL input object, cleaned of null/undefined values
 */
export function prepareCreateServerInput(data: CreateServerFormData): CreateServerInput {
  return {
    port: data.port,
    game: data.game,
    address: data.address,
    rconPassword: data.rconPassword || "",
  }
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
    sortOrder: { set: data.sortOrder },
  }

  if (data.address) {
    serverInput.address = { set: data.address }
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
