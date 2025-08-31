import { forwardRef, ComponentProps } from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@repo/ui/lib/utils"

export interface BasicSelectProps extends ComponentProps<"select"> {
  placeholder?: string
}

const BasicSelect = forwardRef<HTMLSelectElement, BasicSelectProps>(
  ({ className, children, placeholder, ...props }, ref) => {
    return (
      <div className="relative max-w-fit">
        <select
          ref={ref}
          data-slot="select"
          className={cn(
            // Base styling from kitchen sink with adjustments for select
            "w-full rounded-md border text-base border-input font-sans bg-background px-3 py-2 shadow-sm transition-colors",
            // Focus and interaction styles
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            // Active and hover states to prevent grey flash
            "hover:bg-background active:bg-background",
            // Disabled states
            "disabled:cursor-not-allowed disabled:opacity-50",
            // Text and appearance
            "text-foreground",
            // Hide default browser arrow and styling across different browsers
            "[&::-webkit-appearance]:none", // Webkit browsers
            "[&::-moz-appearance]:none", // Firefox
            "[-webkit-appearance:none]", // Safari fallback
            "[-moz-appearance:none]", // Firefox fallback
            // Ensure proper padding for our custom arrow
            "pr-10",
            className,
          )}
          {...props}
        >
          {placeholder && (
            <option value="" disabled className="text-muted-foreground bg-background">
              {placeholder}
            </option>
          )}
          {children}
        </select>
        {/* Custom arrow icon */}
        <ChevronDown
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
      </div>
    )
  },
)

BasicSelect.displayName = "BasicSelect"

export { BasicSelect }
