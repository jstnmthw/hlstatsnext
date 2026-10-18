import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  IconArrowsSort,
  IconBan,
  IconChevronDown,
  IconColumns3,
  IconCopy,
  IconDots,
  IconLogout,
  IconPencil,
  IconServer,
  IconSettings,
  IconTrash,
  IconUser,
  IconUsers,
} from "@tabler/icons-react"
import { useState, type ComponentProps } from "react"
import { fn } from "storybook/test"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./dropdown-menu"

const meta = {
  title: "Components/Dropdown Menu",
  component: DropdownMenu,
  tags: ["autodocs"],
  args: { onOpenChange: fn() },
} satisfies Meta<typeof DropdownMenu>

export default meta

type Story = StoryObj<typeof meta>

const columns = ["Rank", "Kills", "Deaths", "K/D", "Last seen"]

const servers = ["Bangkok 24/7 Dust2", "Deathmatch Arena", "Crossfire Rotation"]

// Radix checkbox and radio items are controlled only, so these examples own their state.
function ColumnsMenu(props: ComponentProps<typeof DropdownMenu>) {
  const [hidden, setHidden] = useState<string[]>(["Last seen"])

  return (
    <DropdownMenu {...props}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <IconColumns3 />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column}
            checked={!hidden.includes(column)}
            onCheckedChange={(checked) =>
              setHidden((current) =>
                checked ? current.filter((c) => c !== column) : [...current, column],
              )
            }
          >
            {column}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SortMenu(props: ComponentProps<typeof DropdownMenu>) {
  const [sort, setSort] = useState("skill")

  return (
    <DropdownMenu {...props}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <IconArrowsSort />
          Sort by
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
          <DropdownMenuRadioItem value="skill">Skill</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="kills">Kills</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="kd">K/D ratio</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="lastSeen">Last seen</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const Default: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Hazel
          <IconChevronDown />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <IconUser />
            Profile
            <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <IconUsers />
            Claimed players
          </DropdownMenuItem>
          <DropdownMenuItem>
            <IconSettings />
            Settings
            <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <IconLogout />
          Sign out
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const Open: Story = { ...Default, args: { defaultOpen: true } }

export const CheckboxItems: Story = {
  render: (args) => <ColumnsMenu {...args} />,
}

export const RadioItems: Story = {
  render: (args) => <SortMenu {...args} />,
}

export const WithSubMenu: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Player actions">
          <IconDots />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem>
          <IconUser />
          View profile
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconCopy />
          Copy Steam ID
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <IconServer />
            Stats on server
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {servers.map((server) => (
              <DropdownMenuItem key={server}>{server}</DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}

export const Destructive: Story = {
  render: (args) => (
    <DropdownMenu {...args}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Server actions">
          <IconDots />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuItem>
          <IconPencil />
          Edit server
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconCopy />
          Copy address
        </DropdownMenuItem>
        <DropdownMenuItem>
          <IconBan />
          Pause ingestion
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">
          <IconTrash />
          Delete server
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
}
