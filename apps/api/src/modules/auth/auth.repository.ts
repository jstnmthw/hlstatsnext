import { db } from "@repo/database/client"
import type { User } from "@repo/database/client"

export class AuthRepository {
  async findUserByUsername(username: string): Promise<User | null> {
    return await db.user.findUnique({
      where: { username },
      include: {
        player: true,
      },
    })
  }

  async createUser(userData: {
    username: string
    password: string
    playerId?: number
    acclevel?: number
  }): Promise<User> {
    return await db.user.create({
      data: {
        username: userData.username,
        password: userData.password,
        playerId: userData.playerId || 0,
        acclevel: userData.acclevel || 0,
      },
      include: {
        player: true,
      },
    })
  }

  async updateUserPassword(username: string, hashedPassword: string): Promise<void> {
    await db.user.update({
      where: { username },
      data: { password: hashedPassword },
    })
  }

  async getUserAccessLevel(username: string): Promise<number | null> {
    const user = await db.user.findUnique({
      where: { username },
      select: { acclevel: true },
    })

    return user?.acclevel ?? null
  }
}
