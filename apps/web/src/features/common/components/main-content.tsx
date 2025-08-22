import { cn } from "@repo/ui/lib/utils"

interface MainContentProps {
  children: React.ReactNode
  fixedHeader?: boolean
}

export function MainContent({ children, fixedHeader = false }: MainContentProps) {
  return (
    <main
      className={cn(
        "flex-1 px-4 md:px-6 lg:px-8 w-full max-w-screen-lg mx-auto",
        fixedHeader && "pt-16",
      )}
    >
      {children}
    </main>
  )
}
