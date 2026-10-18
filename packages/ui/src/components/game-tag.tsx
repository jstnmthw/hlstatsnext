import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@repo/ui/lib/utils"

const gameTagVariants = cva(
  "inline-flex shrink-0 items-center justify-center bg-secondary font-bold text-foreground uppercase select-none",
  {
    variants: {
      size: {
        xs: "size-4 text-[8px]",
        sm: "size-5 text-[9px]",
        default: "size-6 text-[9px]",
        lg: "size-7 text-xs",
        xl: "size-10 text-sm",
      },
      muted: {
        true: "bg-secondary/60 text-muted-foreground",
      },
      outline: {
        true: "border border-input bg-transparent",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
)

interface GameTagProps
  extends Omit<React.ComponentProps<"span">, "children">, VariantProps<typeof gameTagVariants> {
  /** Short game code shown in the tile, e.g. "CS", "HL", "TFC". */
  code: string
}

/** Decorative tile for a game code; pair it with the game's name or give it an aria-label. */
function GameTag({ code, size, muted, outline, className, ...props }: GameTagProps) {
  return (
    <span
      data-slot="game-tag"
      aria-hidden={props["aria-label"] ? undefined : true}
      className={cn(gameTagVariants({ size, muted, outline }), className)}
      {...props}
    >
      {code}
    </span>
  )
}

export { GameTag, gameTagVariants }
export type { GameTagProps }
