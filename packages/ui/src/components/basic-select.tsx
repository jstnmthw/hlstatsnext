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
            "w-full rounded-md border text-base border-input font-sans bg-zinc-800 px-3 py-1 h-9 shadow-sm transition-[color,box-shadow]",
            // Focus and interaction styles
            "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-ring/50",
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
            <option value="" disabled>
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
