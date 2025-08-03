interface PageWrapperProps {
  children: React.ReactNode
  hasFixedHeader?: boolean
}

export function PageWrapper({ children, hasFixedHeader = false }: PageWrapperProps) {
  return (
    <div className={`min-h-screen flex flex-col ${hasFixedHeader ? "pt-16" : ""}`}>{children}</div>
  )
}
