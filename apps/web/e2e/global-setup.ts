import { request, type FullConfig } from "@playwright/test"
import { db } from "@repo/db/client"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { e2eUsers, storageStatePath, type E2EUser } from "./users"

// Users are created through the real sign-up endpoint so Better Auth owns the
// password hash, then verified and given their role directly, then signed in
// so each test can start from a stored cookie jar.
async function createAndSignIn(baseURL: string, user: E2EUser, statePath: string) {
  const api = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } })

  const signUp = await api.post("/api/auth/sign-up/email", {
    data: { name: user.name, email: user.email, password: user.password },
  })
  if (!signUp.ok()) {
    throw new Error(`sign-up for ${user.email} failed: ${signUp.status()} ${await signUp.text()}`)
  }

  await db.user.update({
    where: { email: user.email },
    data: { emailVerified: true, role: user.role },
  })

  const signIn = await api.post("/api/auth/sign-in/email", {
    data: { email: user.email, password: user.password },
  })
  if (!signIn.ok()) {
    throw new Error(`sign-in for ${user.email} failed: ${signIn.status()} ${await signIn.text()}`)
  }

  await mkdir(dirname(statePath), { recursive: true })
  await api.storageState({ path: statePath })
  await api.dispose()
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL
  if (!baseURL) throw new Error("playwright.config.ts must set use.baseURL")

  const emails = Object.values(e2eUsers).map((user) => user.email)
  await db.user.deleteMany({ where: { email: { in: emails } } })

  await createAndSignIn(baseURL, e2eUsers.admin, storageStatePath.admin)
  await createAndSignIn(baseURL, e2eUsers.user, storageStatePath.user)
  await db.$disconnect()
}
