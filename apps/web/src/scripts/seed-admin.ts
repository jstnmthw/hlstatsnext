import { randomBytes } from "crypto"
import { auth } from "@repo/auth"
import { db } from "@repo/database/client"

const ADMIN_EMAIL = "admin@hlstatsnext.local"

async function seedAdmin() {
  // Check if admin already exists
  const existing = await db.user.findUnique({ where: { email: ADMIN_EMAIL } })
  if (existing) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`)
    return
  }

  const password = randomBytes(16).toString("hex")

  // Create user via Better Auth (handles password hashing in account table)
  const result = await auth.api.signUpEmail({
    body: {
      name: "Admin",
      email: ADMIN_EMAIL,
      password,
    },
  })

  if (!result.user) {
    console.error("Failed to create admin user")
    process.exit(1)
  }

  // Set admin role and mark email as verified (avoids needing an authenticated session)
  await db.user.update({
    where: { id: result.user.id },
    data: { role: "admin", emailVerified: true },
  })

  console.log("=".repeat(50))
  console.log("Default admin account created:")
  console.log(`  Email:    ${ADMIN_EMAIL}`)
  console.log(`  Password: ${password}`)
  console.log("=".repeat(50))
}

seedAdmin()
  .catch((error) => {
    console.error("Admin seeding failed:", error)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
