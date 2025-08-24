import { cn } from "@repo/ui"

interface FormFieldProps {
  children: React.ReactNode
  className?: string
}

export function FormField({ children, className }: FormFieldProps) {
  return <div className={cn("space-y-2", className)}>{children}</div>
}

interface ErrorMessageProps {
  children: React.ReactNode
  className?: string
}

export function ErrorMessage({ children, className }: ErrorMessageProps) {
  return <p className={cn("text-sm text-red-500", className)}>{children}</p>
}
