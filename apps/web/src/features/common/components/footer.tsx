import { APP_VERSION } from "@/lib/app-version"
import { isAdmin } from "@repo/auth/permissions"
import { getSession } from "@repo/auth/session"
import { TextLink } from "@repo/ui"
import Link from "next/link"

export async function Footer() {
  const session = await getSession()

  return (
    <footer className="w-full border-t">
      <div className="container flex flex-wrap items-center justify-between gap-4 py-5 text-muted-foreground">
        <span>
          {process.env.NEXT_PUBLIC_APP_NAME} v{APP_VERSION} &middot; &copy;{" "}
          {new Date().getFullYear()}
        </span>
        <span className="flex gap-4">
          <TextLink asChild>
            <Link href="/servers">All servers</Link>
          </TextLink>
          <TextLink asChild>
            <Link href="/players">Players</Link>
          </TextLink>
          {session && isAdmin(session.user) && (
            <TextLink asChild>
              <Link href="/admin">Admin</Link>
            </TextLink>
          )}
        </span>
      </div>
    </footer>
  )
}
