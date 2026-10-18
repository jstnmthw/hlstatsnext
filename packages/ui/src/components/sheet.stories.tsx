import type { Meta, StoryObj } from "@storybook/react-vite"
import { fn } from "storybook/test"
import { Button } from "./button"
import { Input } from "./input"
import { Label } from "./label"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet"

const meta = {
  title: "Components/Sheet",
  component: Sheet,
  tags: ["autodocs"],
  args: { onOpenChange: fn() },
} satisfies Meta<typeof Sheet>

export default meta

type Story = StoryObj<typeof meta>

const games = [
  { name: "Counter-Strike 1.6", players: "1,284" },
  { name: "Half-Life Deathmatch", players: "312" },
  { name: "Team Fortress Classic", players: "97" },
]

export const Default: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button variant="outline">Server details</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Bangkok 24/7 Dust2</SheetTitle>
          <SheetDescription>Counter-Strike 1.6 · 203.0.113.42:27015</SheetDescription>
        </SheetHeader>
        <dl className="grid grid-cols-2 gap-y-2 px-4">
          <dt className="text-muted-foreground">Map</dt>
          <dd className="text-right">de_dust2</dd>
          <dt className="text-muted-foreground">Players</dt>
          <dd className="text-right">14/32</dd>
          <dt className="text-muted-foreground">Uptime</dt>
          <dd className="text-right">99.2%</dd>
          <dt className="text-muted-foreground">Last event</dt>
          <dd className="text-right">12 seconds ago</dd>
        </dl>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline">Close</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
}

export const Open: Story = { ...Default, args: { defaultOpen: true } }

export const Left: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button variant="outline">Browse games</Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle>Games</SheetTitle>
          <SheetDescription>Pick a game to view its rankings.</SheetDescription>
        </SheetHeader>
        <nav className="grid gap-1 px-2">
          {games.map((game) => (
            <Button key={game.name} variant="ghost" className="justify-between">
              {game.name}
              <span className="text-muted-foreground">{game.players}</span>
            </Button>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  ),
}

export const WithForm: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetTrigger asChild>
        <Button>Edit server</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit server</SheetTitle>
          <SheetDescription>Changes apply the next time the daemon reconnects.</SheetDescription>
        </SheetHeader>
        <form
          id="edit-server"
          className="grid gap-4 px-4"
          onSubmit={(event) => event.preventDefault()}
        >
          <div className="grid gap-2">
            <Label htmlFor="server-name" required>
              Name
            </Label>
            <Input id="server-name" defaultValue="Bangkok 24/7 Dust2" />
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <div className="grid gap-2">
              <Label htmlFor="server-address" required>
                Address
              </Label>
              <Input id="server-address" defaultValue="203.0.113.42" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="server-port">Port</Label>
              <Input id="server-port" type="number" defaultValue={27015} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rcon-password">RCON password</Label>
            <Input id="rcon-password" type="password" placeholder="Unchanged" />
          </div>
        </form>
        <SheetFooter className="sm:flex-row sm:justify-end">
          <SheetClose asChild>
            <Button variant="outline">Cancel</Button>
          </SheetClose>
          <Button type="submit" form="edit-server">
            Save changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
}
