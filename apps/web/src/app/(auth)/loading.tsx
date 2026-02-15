import { LoaderCircleIcon } from "@repo/ui"

export default function AuthLoading() {
  return (
    <div className="flex items-center justify-center">
      <LoaderCircleIcon className="size-8 animate-spin text-zinc-400" />
    </div>
  )
}
