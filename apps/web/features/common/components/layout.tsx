interface LayoutProps {
  children: React.ReactNode
  hasFixedHeader?: boolean
}

export function Layout({ children, hasFixedHeader = false }: LayoutProps) {
  return (
    <div className={`min-h-screen flex flex-col ${hasFixedHeader ? "pt-16" : ""}`}>{children}</div>
  )
}
