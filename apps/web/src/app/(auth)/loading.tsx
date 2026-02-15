import { IconLoader2 } from "@repo/ui"

export default function AuthLoading() {
  return (
    <div className="flex items-center justify-center">
      <IconLoader2 className="size-8 animate-spin text-zinc-400" />
    </div>
  )
}
