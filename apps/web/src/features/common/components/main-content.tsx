import { cn } from "@repo/ui"

interface MainContentProps {
  children: React.ReactNode
  fixedHeader?: boolean
}

export function MainContent({ children, fixedHeader = false }: MainContentProps) {
  return <main className={cn("flex-1 container", fixedHeader && "pt-16")}>{children}</main>
}
