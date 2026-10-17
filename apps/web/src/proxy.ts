import { getCookieCache, getSessionCookie } from "@repo/auth/cookies"
import { getEnv } from "@repo/auth/env"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const signInPages = new Set(["/login", "/register"])

// Routing only: this never reads the session. Every layout, data module and
// action verifies it with the helpers in @repo/auth/session.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (signInPages.has(pathname)) {
    // The signed cookie cache expires after five minutes, so a session revoked
    // elsewhere stops bouncing its holder away from the sign-in page by itself.
    const cached = await getCookieCache(request, { secret: getEnv().BETTER_AUTH_SECRET })
    return cached ? NextResponse.redirect(new URL("/", request.url)) : NextResponse.next()
  }

  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*", "/accounts/:path*", "/login", "/register"],
}
