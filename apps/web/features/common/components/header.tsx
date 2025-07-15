import { cn } from "@repo/ui/lib/utils"

interface HeaderProps {
  fixed?: boolean
}

export function Header({ fixed = false }: HeaderProps) {
  return (
    <header className={cn("w-full", fixed && "fixed top-0 left-0 right-0 z-50")}>
      <div className="max-w-screen-lg mx-auto py-4 font-bold">
        {process.env.NEXT_PUBLIC_APP_NAME}{" "}
        <span className="text-xs text-muted-foreground">v1.0.0</span>
      </div>
    </header>
  )
}
