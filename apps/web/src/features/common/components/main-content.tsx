import { cn } from "@repo/ui"

interface MainContentProps {
  children: React.ReactNode
  fixedHeader?: boolean
  className?: string
}

export function MainContent({ children, fixedHeader = false, className }: MainContentProps) {
  return <main className={cn("flex-1", fixedHeader && "pt-30", className)}>{children}</main>
}
