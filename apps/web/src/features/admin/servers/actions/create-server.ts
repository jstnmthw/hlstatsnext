"use server"

import type { DocumentNode } from "graphql"

import { z } from "zod"
import { redirect } from "next/navigation"
import { getClient } from "@/lib/apollo-client"
import { CREATE_SERVER_MUTATION } from "@/features/admin/servers/graphql/server-mutations"

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

const CreateServerSchema = z.object({
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
  rconPassword: z.string().optional(),
})

export type CreateServerFormData = z.infer<typeof CreateServerSchema>

export type CreateServerResult = {
  success: boolean
  message: string
  errors?: Record<string, string[]>
}

export async function createServer(
  _prevState: CreateServerResult,
  formData: FormData,
): Promise<CreateServerResult> {
  try {
    // Extract and validate form data
    const rawData = {
      address: formData.get("address"),
      port: formData.get("port"),
      game: formData.get("game"),
      rconPassword: formData.get("rconPassword"),
    }

    const validation = CreateServerSchema.safeParse(rawData)

    if (!validation.success) {
      return {
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors,
      }
    }

    const data = validation.data

    // Prepare GraphQL input
    const serverInput = {
      address: data.address,
      port: data.port,
      game: data.game,
      // Only include rconPassword if it's provided
      ...(data.rconPassword && { rconPassword: data.rconPassword }),
    }

    // Execute GraphQL mutation
    const client = getClient()
    const result = await client.mutate({
      mutation: CREATE_SERVER_MUTATION as DocumentNode,
      variables: {
        data: serverInput,
      },
    })

    if (!result.data?.createServerWithConfig) {
      console.error("GraphQL mutation failed")
      return {
        success: false,
        message: "Failed to create server. Please try again.",
      }
    }

    const { success, message, configsCount } = result.data.createServerWithConfig

    if (!success) {
      return {
        success: false,
        message: message || "Failed to create server. Please try again.",
      }
    }

    console.log(`Server created successfully with ${configsCount} configuration entries`)

    // Redirect to admin page on success
    redirect("/admin")
  } catch (error) {
    // Let Next.js redirect errors pass through
    if (error && typeof error === "object" && "message" in error) {
      const errorMessage = (error as Error).message
      if (errorMessage === "NEXT_REDIRECT") {
        throw error
      }
    }

    console.error("Server creation error:", error)

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
