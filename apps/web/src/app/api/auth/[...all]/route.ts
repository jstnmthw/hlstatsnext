import { auth, toNextJsHandler } from "@repo/auth/server"

export const { GET, POST } = toNextJsHandler(auth)
