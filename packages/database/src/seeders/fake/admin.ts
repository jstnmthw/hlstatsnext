import { randomBytes, randomUUID } from "crypto"
import { hashPassword } from "better-auth/crypto"
import { db } from "../../client"
import { log, logSuccess, logWarning } from "./logger"

const DEFAULT_ADMIN_EMAIL = "admin@hlstatsnext.local"

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL

  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    logWarning(`Admin already exists: ${email}`)
    return
  }

  const password = process.env.ADMIN_PASSWORD || randomBytes(16).toString("hex")
  const hashedPassword = await hashPassword(password)

  const userId = randomUUID()

  await db.$transaction([
    db.user.create({
      data: {
        id: userId,
        name: "Admin",
        email,
        emailVerified: true,
        role: "admin",
      },
    }),
    db.account.create({
      data: {
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashedPassword,
      },
    }),
  ])

  logSuccess(`Admin created: ${email}`)

  if (!process.env.ADMIN_PASSWORD) {
    log(`  Password: ${password}`)
    log(`  Set ADMIN_PASSWORD env var to use a fixed password`)
  }
}
