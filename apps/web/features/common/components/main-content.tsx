import { cn } from "@repo/ui/utils"

interface MainContentProps {
  children: React.ReactNode
  fixedHeader?: boolean
}

export function MainContent({ children, fixedHeader = false }: MainContentProps) {
  return (
    <main className={cn("flex-1 w-full max-w-screen-lg mx-auto", fixedHeader && "pt-16")}>
      {children}
    </main>
  )
}
