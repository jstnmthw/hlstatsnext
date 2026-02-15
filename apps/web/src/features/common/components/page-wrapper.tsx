interface PageWrapperProps {
  children: React.ReactNode
  hasFixedHeader?: boolean
}

export function PageWrapper({ children, hasFixedHeader = false }: PageWrapperProps) {
  return (
    <div className={`flex min-h-screen flex-col ${hasFixedHeader ? "pt-16" : ""}`}>{children}</div>
  )
}
