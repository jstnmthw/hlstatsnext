import type { User } from "@repo/database/client"
import { db } from "@repo/database/client"

export class AuthRepository {
  async findUserByEmail(email: string): Promise<User | null> {
    return await db.user.findUnique({
      where: { email },
    })
  }

  async findUserById(id: string): Promise<User | null> {
    return await db.user.findUnique({
      where: { id },
    })
  }

  async findAccountCredential(userId: string) {
    return await db.account.findFirst({
      where: { userId, providerId: "credential" },
    })
  }

  async getUserRole(email: string): Promise<string | null> {
    const user = await db.user.findUnique({
      where: { email },
      select: { role: true },
    })

    return user?.role ?? null
  }
}
