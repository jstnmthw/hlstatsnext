"use server"

import { REVOKE_SERVER_TOKEN } from "@/features/admin/tokens/graphql/token-mutations"
import { getClient } from "@/lib/apollo-client"
import { getSession } from "@repo/auth/session"
import { revalidatePath } from "next/cache"

export async function revokeToken(tokenId: number): Promise<{ success: boolean; message: string }> {
  const session = await getSession()
  if (!session) {
    return { success: false, message: "Authentication required." }
  }

  try {
    const client = getClient()
    const result = await client.mutate({
      mutation: REVOKE_SERVER_TOKEN,
      variables: {
        input: { id: tokenId },
      },
    })

    const data = result.data?.revokeServerToken
    if (!data?.success) {
      return {
        success: false,
        message: data?.message ?? "Failed to revoke token.",
      }
    }

    revalidatePath("/admin/tokens")

    return {
      success: true,
      message: data.message ?? "Token revoked successfully.",
    }
  } catch (error) {
    console.error("Token revocation error:", error)
    return {
      success: false,
      message: "An unexpected error occurred. Please try again.",
    }
  }
}
