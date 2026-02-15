import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { auth } from "@repo/auth/server"
import { getSessionCookie } from "@repo/auth"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Admin routes require a valid admin session
  if (pathname.startsWith("/admin")) {
    const sessionCookie = getSessionCookie(request)

    // No cookie at all — fast redirect, no DB call
    if (!sessionCookie) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    // Cookie exists — validate the session (uses cookieCache, typically no DB hit)
    const session = await auth.api.getSession({
      headers: request.headers,
    })

    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url))
    }

    if (session.user.role !== "admin") {
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)"],
}
