"use server"

import type { DocumentNode } from "graphql"

import { z } from "zod"
import { redirect } from "next/navigation"
import { getClient } from "@/lib/apollo-client"
import { UPDATE_SERVER_MUTATION } from "@/features/admin/servers/graphql/server-mutations"

// IP address validation helper
const isValidIPAddress = (ip: string): boolean => {
  // Check basic format (xxx.xxx.xxx.xxx)
  const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const match = ip.match(ipRegex)

  if (!match) {
    return false
  }

  // Validate each octet is 0-255
  const octets = match.slice(1, 5)
  return octets.every((octet) => {
    const num = parseInt(octet, 10)
    return num >= 0 && num <= 255
  })
}

const UpdateServerSchema = z.object({
  serverId: z.coerce.number().int().positive("Server ID is required"),
  name: z.string().max(255, "Name is too long").optional(),
  address: z
    .string()
    .min(1, "Server address is required")
    .max(15, "IP address is too long")
    .refine(isValidIPAddress, {
      message: "Please enter a valid IP address (e.g., 192.168.1.1)",
    }),
  port: z.coerce
    .number()
    .int()
    .min(1, "Port must be greater than 0")
    .max(65535, "Port must be less than 65535"),
  game: z.string().optional().default("cstrike"),
  publicAddress: z.string().max(128, "Public address is too long").optional(),
  statusUrl: z
    .string()
    .url("Please enter a valid URL")
    .max(255, "Status URL is too long")
    .optional()
    .or(z.literal("")),
  rconPassword: z.string().max(255, "RCON password is too long").optional(),
  connectionType: z.enum(["external", "docker"]).optional().default("external"),
  dockerHost: z.string().max(255, "Docker host is too long").optional(),
  sortOrder: z.coerce.number().int().min(0).max(127).optional().default(0),
})

export type UpdateServerFormData = z.infer<typeof UpdateServerSchema>

export type UpdateServerResult = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function updateServer(
  _prevState: UpdateServerResult,
  formData: FormData,
): Promise<UpdateServerResult> {
  try {
    // Extract and validate form data
    const rawData = {
      serverId: formData.get("serverId"),
      name: formData.get("name"),
      address: formData.get("address"),
      port: formData.get("port"),
      game: formData.get("game"),
      publicAddress: formData.get("publicAddress"),
      statusUrl: formData.get("statusUrl"),
      rconPassword: formData.get("rconPassword"),
      connectionType: formData.get("connectionType"),
      dockerHost: formData.get("dockerHost"),
      sortOrder: formData.get("sortOrder"),
    }

    const validation = UpdateServerSchema.safeParse(rawData)

    if (!validation.success) {
      return {
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      }
    }

    const data = validation.data

    // Additional validation: Docker host is required for docker connection type
    if (data.connectionType === "docker" && (!data.dockerHost || data.dockerHost.trim() === "")) {
      return {
        success: false,
        message: "Docker host is required for Docker connection type",
        errors: {
          dockerHost: ["Docker host is required when connection type is Docker"],
        },
      }
    }

    // Prepare GraphQL input - only include fields that have values
    const serverInput: Record<string, string | number> = {
      address: data.address,
      port: data.port,
      game: data.game,
      connectionType: data.connectionType,
      sortOrder: data.sortOrder,
    }

    // Only include optional fields if they have values
    if (data.name && data.name.trim() !== "") {
      serverInput.name = data.name.trim()
    }
    if (data.publicAddress && data.publicAddress.trim() !== "") {
      serverInput.publicAddress = data.publicAddress.trim()
    }
    if (data.statusUrl && data.statusUrl.trim() !== "") {
      serverInput.statusUrl = data.statusUrl.trim()
    }
    if (data.rconPassword && data.rconPassword.trim() !== "") {
      serverInput.rconPassword = data.rconPassword.trim()
    }
    if (data.dockerHost && data.dockerHost.trim() !== "") {
      serverInput.dockerHost = data.dockerHost.trim()
    }

    // Execute GraphQL mutation
    const client = getClient()
    const result = await client.mutate({
      mutation: UPDATE_SERVER_MUTATION as DocumentNode,
      variables: {
        where: {
          serverId: data.serverId,
        },
        data: serverInput,
      },
    })

    if (!result.data?.updateOneServer) {
      console.error("GraphQL mutation failed")
      return {
        success: false,
        message: "Failed to update server. Please try again.",
      }
    }

    // Redirect to admin servers page on success
    redirect("/admin/servers")
  } catch (error) {
    // Let Next.js redirect errors pass through
    if (error && typeof error === "object" && "message" in error) {
      const errorMessage = (error as Error).message
      if (errorMessage === "NEXT_REDIRECT") {
        throw error
      }
    }

    console.error("Server update error:", error)

    // Handle Prisma unique constraint errors
    if (error && typeof error === "object" && "message" in error) {
      const errorMessage = (error as Error).message
      if (
        errorMessage.includes("Unique constraint failed") &&
        (errorMessage.includes("servers_address_port_key") || errorMessage.includes("addressport"))
      ) {
        return {
          success: false,
          message: "A server with this address and port already exists.",
          errors: {
            address: ["This server address and port combination is already in use"],
            port: ["This server address and port combination is already in use"],
          },
        }
      }
    }

    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    }
  }
}
