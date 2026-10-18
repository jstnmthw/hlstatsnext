import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconSearch, IconSlashes, IconUser } from "@tabler/icons-react"
import { Avatar, AvatarFallback } from "../components/avatar"
import { Button } from "../components/button"
import { TextLink } from "../components/text-link"

const navItems = ["Home", "Rankings", "Servers", "Players", "Awards"]

function Logo() {
  return (
    <TextLink href="#" variant="row" className="flex items-center gap-2 hover:no-underline">
      <IconSlashes className="size-5 text-primary-bright" />
      <span className="font-bold tracking-tight uppercase">HLStatsNext</span>
      <span className="text-xs font-normal text-muted-foreground">v0.1.0</span>
    </TextLink>
  )
}

function SiteHeader({ current = "Home", user }: { current?: string; user?: string }) {
  return (
    <header className="w-full border-b">
      <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-4 px-8">
        <Logo />
        <nav aria-label="Primary" className="flex flex-wrap gap-1">
          {navItems.map((item) => (
            <TextLink
              key={item}
              href="#"
              variant="nav"
              aria-current={item === current ? "page" : undefined}
            >
              {item}
            </TextLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Search players and servers">
            <IconSearch />
          </Button>
          {user ? (
            <span className="inline-flex items-center gap-2 px-2.5 text-muted-foreground">
              <Avatar size="sm" shape="square">
                <AvatarFallback className="text-xs">
                  {user.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {user}
            </span>
          ) : (
            <TextLink href="#" variant="nav">
              <IconUser />
              Sign in
            </TextLink>
          )}
        </div>
      </div>
    </header>
  )
}

function SiteFooter() {
  return (
    <footer className="w-full border-t">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-8 py-5 text-muted-foreground">
        <span>HLStatsNext v0.1.0 · [YOUR COMMUNITY]</span>
        <span className="flex gap-4">
          <TextLink href="#">All servers</TextLink>
          <TextLink href="#">Rankings</TextLink>
          <TextLink href="#">Admin</TextLink>
        </span>
      </div>
    </footer>
  )
}

const meta = {
  title: "Patterns/Site chrome",
  parameters: { layout: "fullscreen" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const Header: Story = {
  render: () => <SiteHeader />,
}

export const HeaderSignedIn: Story = {
  render: () => <SiteHeader current="Players" user="justin@example.com" />,
}

export const Footer: Story = {
  render: () => <SiteFooter />,
}

export const Page: Story = {
  render: () => (
    <div className="flex min-h-screen flex-col">
      <SiteHeader current="Rankings" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-8 py-10 text-muted-foreground">
        Page content
      </main>
      <SiteFooter />
    </div>
  ),
}
