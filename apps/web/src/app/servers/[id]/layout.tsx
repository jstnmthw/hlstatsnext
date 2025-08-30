import { ReactNode } from "react"

interface ServerLayoutProps {
  children: ReactNode
  params: Promise<{ id: string }>
}

export default async function ServerLayout({ children }: ServerLayoutProps) {
  // For now, we'll just pass through the children
  // In the future, we might add shared navigation or other server-specific layout elements
  return <>{children}</>
}
