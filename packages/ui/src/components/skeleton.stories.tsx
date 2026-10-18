import type { Meta, StoryObj } from "@storybook/react-vite"
import { Skeleton } from "./skeleton"

const meta = {
  title: "Components/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  args: { className: "h-4 w-48" },
} satisfies Meta<typeof Skeleton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const StatTile: Story = {
  render: () => (
    <div className="flex w-44 flex-col gap-2 rounded-xl border bg-card px-5 py-4">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-28" />
    </div>
  ),
}

export const TableRows: Story = {
  render: () => (
    <div className="flex w-md flex-col divide-y rounded-xl border bg-card">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton className="size-8" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  ),
}
