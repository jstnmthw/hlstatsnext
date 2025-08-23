"use server"

import { getClient } from "@/lib/apollo-client"
import { CREATE_SERVER_MUTATION } from "@/features/admin/graphql/server-mutations"
import { z } from "zod"
import { redirect } from "next/navigation"
import type { DocumentNode } from "graphql"

const CreateServerSchema = z.object({
  name: z
    .string()
    .min(1, "Server name is required")
    .max(100, "Server name must be less than 100 characters"),
  address: z
    .string()
    .min(1, "Server address is required")
    .max(255, "Server address must be less than 255 characters"),
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
      name: formData.get("name"),
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
      name: data.name,
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

    if (result.errors) {
      console.error("GraphQL errors:", result.errors)
      return {
        success: false,
        message: "Failed to create server. Please try again.",
      }
    }

    console.log("Server created successfully:", result.data?.createOneServer)

    // Redirect to admin page on success
    redirect("/admin")
  } catch (error) {
    console.error("Server creation error:", error)
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    }
  }
}
