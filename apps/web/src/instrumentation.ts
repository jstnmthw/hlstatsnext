export async function register() {
  // Only the Node runtime serves pages and actions; the edge bundle must not pull in Prisma.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getAuth } = await import("@repo/auth/server")
    getAuth()
  }
}
