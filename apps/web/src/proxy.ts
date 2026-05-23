import { auth } from "@repo/auth"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next()
  }

  // Full session validation — not just cookie presence
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (session.user.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
