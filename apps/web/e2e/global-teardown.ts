import { db } from "@repo/db/client"
import { e2eUsers } from "./users"

export default async function globalTeardown() {
  const emails = Object.values(e2eUsers).map((user) => user.email)
  await db.user.deleteMany({ where: { email: { in: emails } } })
  await db.$disconnect()
}
