"use server"

import { CREATE_SERVER_TOKEN } from "@/features/admin/tokens/graphql/token-mutations"
import { getClient } from "@/lib/apollo-client"
import { getSession } from "@repo/auth/session"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const CreateTokenSchema = z.object({
  name: z.string().min(1, "Name is required").max(128, "Name is too long"),
  game: z.string().min(1, "Game type is required"),
  rconPassword: z.string().max(255, "RCON password is too long").optional(),
  expiresAt: z.string().optional(),
})

export type TokenOperationResult = {
  success: boolean
  message: string
  rawToken?: string | null
  errors?: Record<string, string[]>
}

export async function createToken(
  _prevState: TokenOperationResult,
  formData: FormData,
): Promise<TokenOperationResult> {
  try {
    const session = await getSession()
    if (!session) {
      return { success: false, message: "Authentication required." }
    }

    const rawData = {
      name: formData.get("name") as string,
      game: formData.get("game") as string,
      rconPassword: formData.get("rconPassword") as string,
      expiresAt: formData.get("expiresAt") as string,
    }

    const validation = CreateTokenSchema.safeParse(rawData)
    if (!validation.success) {
      return {
        success: false,
        message: "Validation failed",
        errors: validation.error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    const { name, game, rconPassword, expiresAt } = validation.data

    const client = getClient()
    const result = await client.mutate({
      mutation: CREATE_SERVER_TOKEN,
      variables: {
        input: {
          name,
          game,
          rconPassword: rconPassword || undefined,
          expiresAt: expiresAt || undefined,
        },
      },
    })

    const data = result.data?.createServerToken
    if (!data?.success) {
      return {
        success: false,
        message: data?.message ?? "Failed to create token.",
      }
    }

    revalidatePath("/admin/tokens")

    return {
      success: true,
      message: data.message ?? "Token created successfully.",
      rawToken: data.rawToken,
    }
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") {
      throw error
    }

    console.error("Token creation error:", error)
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    }
  }
}
