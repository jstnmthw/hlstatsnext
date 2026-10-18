import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconChevronRight, IconDots, IconServer, IconTrophy } from "@tabler/icons-react"
import { Button } from "./button"
import { FlagIcon } from "./flag-icon"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "./item"

const meta = {
  title: "Components/Item",
  component: Item,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  args: { variant: "default", size: "default" },
  argTypes: {
    variant: { control: "select", options: ["default", "outline", "muted"] },
    size: { control: "select", options: ["default", "sm", "xs"] },
  },
} satisfies Meta<typeof Item>

export default meta

type Story = StoryObj<typeof meta>

// Placeholder art served from packages/ui/public; real avatars come from Steam at runtime.
const placeholderAvatar = "/avatars/placeholder-3.svg"

const servers = [
  { name: "Bangkok 24/7 Dust2", address: "203.0.113.42:27015", map: "de_dust2", players: "14/32" },
  { name: "Deathmatch Arena", address: "203.0.113.42:27016", map: "fy_pool_day", players: "9/16" },
  { name: "Crossfire Rotation", address: "203.0.113.42:27017", map: "de_inferno", players: "0/24" },
]

const players = [
  { name: "Hazel", code: "th", country: "Thailand", skill: "1,842" },
  { name: "drexx", code: "de", country: "Germany", skill: "1,610" },
  { name: "Mintcake", code: "se", country: "Sweden", skill: "1,577" },
]

const variants = ["default", "outline", "muted"] as const

const sizes = ["default", "sm", "xs"] as const

export const Default: Story = {
  args: { variant: "outline" },
  render: (args) => (
    <Item {...args} className="max-w-lg">
      <ItemMedia variant="icon">
        <IconServer />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Bangkok 24/7 Dust2</ItemTitle>
        <ItemDescription>203.0.113.42:27015 · de_dust2 · 14/32 players</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" size="sm">
          Connect
        </Button>
      </ItemActions>
    </Item>
  ),
}

export const Group: Story = {
  args: { size: "sm" },
  render: (args) => (
    <ItemGroup className="max-w-lg rounded-md border">
      {servers.map((server, index) => (
        <div key={server.name}>
          {index > 0 && <ItemSeparator />}
          <Item {...args}>
            <ItemMedia variant="icon">
              <IconServer />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>{server.name}</ItemTitle>
              <ItemDescription>
                {server.address} · {server.map} · {server.players} players
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button variant="ghost" size="icon-sm" aria-label="Server actions">
                <IconDots />
              </Button>
            </ItemActions>
          </Item>
        </div>
      ))}
    </ItemGroup>
  ),
}

export const WithImage: Story = {
  args: { size: "sm" },
  render: (args) => (
    <ItemGroup className="max-w-lg">
      {players.map((player) => (
        <Item key={player.name} {...args}>
          <ItemMedia variant="image">
            <img src={placeholderAvatar} alt="" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              <FlagIcon code={player.code} name={player.country} />
              {player.name}
            </ItemTitle>
            <ItemDescription>
              {player.country} · {player.skill} skill
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="outline" size="sm">
              Profile
            </Button>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  ),
}

export const Variants: Story = {
  render: (args) => (
    <div className="grid max-w-lg gap-3">
      {variants.map((variant) => (
        <Item key={variant} {...args} variant={variant}>
          <ItemMedia variant="icon">
            <IconServer />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="capitalize">{variant}</ItemTitle>
            <ItemDescription>Deathmatch Arena · fy_pool_day · 9/16 players</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </div>
  ),
}

export const Sizes: Story = {
  args: { variant: "outline" },
  render: (args) => (
    <div className="grid max-w-lg gap-3">
      {sizes.map((size) => (
        <Item key={size} {...args} size={size}>
          <ItemMedia variant="icon">
            <IconServer />
          </ItemMedia>
          <ItemContent>
            <ItemTitle className="capitalize">{size}</ItemTitle>
            <ItemDescription>Crossfire Rotation · de_inferno · 0/24 players</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </div>
  ),
}

export const AsLink: Story = {
  args: { variant: "outline" },
  render: (args) => (
    <Item {...args} asChild className="max-w-lg">
      <a href="#">
        <ItemMedia variant="icon">
          <IconTrophy />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Counter-Strike 1.6 rankings</ItemTitle>
          <ItemDescription>1,284 ranked players across 3 servers</ItemDescription>
        </ItemContent>
        <ItemActions>
          <IconChevronRight className="size-4 text-muted-foreground" />
        </ItemActions>
      </a>
    </Item>
  ),
}

export const Active: Story = {
  args: { size: "sm" },
  render: (args) => (
    <ItemGroup className="max-w-lg gap-1">
      {servers.map((server, index) => (
        <Item key={server.name} {...args} data-active={index === 0 ? "true" : undefined}>
          <ItemMedia variant="icon">
            <IconServer />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{server.name}</ItemTitle>
            <ItemDescription>
              {server.map} · {server.players} players
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  ),
}
