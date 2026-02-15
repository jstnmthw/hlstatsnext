import { LoaderCircleIcon } from "@repo/ui"

export default function AdminLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <LoaderCircleIcon className="size-8 animate-spin text-zinc-400" />
    </div>
  )
}
