import { getAuth, toNextJsHandler } from "@repo/auth/server"

// Resolved per request so `next build` can evaluate this module without an environment.
export const GET = (request: Request) => toNextJsHandler(getAuth()).GET(request)
export const POST = (request: Request) => toNextJsHandler(getAuth()).POST(request)
