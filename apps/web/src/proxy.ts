import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { getSessionCookie } from "@repo/auth/cookies"

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Redirect unauthenticated users away from admin pages
  if (pathname.startsWith("/admin") && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt).*)"],
}
