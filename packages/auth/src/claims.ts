import { db } from "@repo/db/client"

/**
 * Give a user every player whose SteamID64 is theirs, as recorded by the daemon
 * in player_unique_ids. A player already claimed by this user is left alone; one
 * claimed by someone else moves, because a fresh Steam proof outranks an old
 * one. Returns how many rows were created or moved.
 */
export async function claimPlayersBySteamId(userId: string, steamId: string): Promise<number> {
  const identities = await db.playerUniqueId.findMany({
    where: { uniqueId: steamId },
    select: { playerId: true, game: true },
  })
  if (identities.length === 0) return 0

  const existing = await db.userPlayer.findMany({
    where: { playerId: { in: identities.map((identity) => identity.playerId) } },
    select: { playerId: true, userId: true },
  })
  const ownerOf = new Map(existing.map((claim) => [claim.playerId, claim.userId]))

  let written = 0
  for (const { playerId, game } of identities) {
    const owner = ownerOf.get(playerId)
    if (owner === userId) continue
    if (owner === undefined) {
      await db.userPlayer.create({ data: { playerId, userId, game } })
    } else {
      await db.userPlayer.update({
        where: { playerId },
        data: { userId, game, claimedAt: new Date() },
      })
    }
    written += 1
  }
  return written
}

/**
 * Forget the Steam identity on the user row once the Steam account is unlinked.
 * better-auth-steam sets `user.steamId` on link but has no unlink hook, and
 * Better Auth's own endpoints refuse to write a plugin field, so this is the one
 * place outside Better Auth that writes the user table. Claims stay: the person
 * proved ownership when the link was made.
 */
export async function forgetSteamId(userId: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { steamId: null } })
}
