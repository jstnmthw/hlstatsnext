import type { Meta, StoryObj } from "@storybook/react-vite"
import { useState } from "react"
import {
  Pagination,
  PaginationButton,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
  PaginationSummary,
} from "./pagination"

const meta = {
  title: "Components/Pagination",
  component: Pagination,
  tags: ["autodocs"],
} satisfies Meta<typeof Pagination>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Pagination {...args}>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" disabled />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" isActive>
            1
          </PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">2</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">162</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  ),
}

export const WithSummary: Story = {
  parameters: { layout: "padded" },
  render: (args) => (
    <div className="flex w-4xl flex-wrap items-center justify-between gap-4">
      <PaginationSummary>Showing 1–15 of 2,106</PaginationSummary>
      <Pagination {...args}>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" disabled />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">3</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">162</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  ),
}

function ClientPagination() {
  const [page, setPage] = useState(1)
  const pages = 8

  return (
    <div className="flex flex-col items-center gap-3">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationButton disabled={page === 1} onClick={() => setPage(page - 1)}>
              Previous
            </PaginationButton>
          </PaginationItem>
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <PaginationItem key={n}>
              <PaginationButton isActive={n === page} onClick={() => setPage(n)}>
                {n}
              </PaginationButton>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationButton disabled={page === pages} onClick={() => setPage(page + 1)}>
              Next
            </PaginationButton>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <PaginationSummary>
        Page {page} of {pages}
      </PaginationSummary>
    </div>
  )
}

export const Buttons: Story = {
  render: () => <ClientPagination />,
}
