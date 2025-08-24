import { cn } from "@repo/ui"

interface FormFieldProps {
  children: React.ReactNode
  className?: string
}

interface ErrorMessageProps {
  children: React.ReactNode
  className?: string
}

export function FormField({ children, className }: FormFieldProps) {
  return <div className={cn("space-y-2", className)}>{children}</div>
}

export function ErrorMessage({ children, className }: ErrorMessageProps) {
  return <p className={cn("text-sm text-red-500", className)}>{children}</p>
}

export function ErrorDisplay({
  state,
  pending,
}: {
  state: { success: boolean; message: string }
  pending: boolean
}) {
  if (state.success || !state.message || pending) {
    return null
  }

  return (
    <div className="px-3 py-2 border rounded-md !border-red-500/20 flex items-center justify-between transition-opacity duration-200 opacity-100">
      <p className="text-red-800 text-sm dark:text-red-500">{state.message}</p>
    </div>
  )
}
