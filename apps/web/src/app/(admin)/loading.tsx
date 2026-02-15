import { IconLoader2 } from "@repo/ui"

export default function AdminLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <IconLoader2 className="size-8 animate-spin text-zinc-400" />
    </div>
  )
}
