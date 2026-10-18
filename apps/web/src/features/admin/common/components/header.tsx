import { AccountMenu } from "@/features/common/components/account-menu"
import { AppLogo } from "@/features/common/components/app-logo"
import { getSession } from "@repo/auth"
import { isAdmin } from "@repo/auth/permissions"
import { Badge, cn } from "@repo/ui"
import { Navbar } from "./navbar"

interface AdminHeaderProps {
  className?: string
  currentPath?: string
}

export async function AdminHeader({ className, currentPath }: AdminHeaderProps) {
  const session = await getSession()

  return (
    <>
      <header className={cn("w-full", className)}>
        <div className={cn("container flex items-center justify-between py-6")}>
          <div className="flex items-center gap-2">
            <AppLogo showVersion={true} />
            <Badge variant="primary">Admin</Badge>
          </div>
          {session && (
            <AccountMenu
              user={{
                name: session.user.name,
                email: session.user.email,
                image: session.user.image,
              }}
              isAdmin={isAdmin(session.user)}
            />
          )}
        </div>
      </header>
      <Navbar currentPath={currentPath} />
    </>
  )
}
