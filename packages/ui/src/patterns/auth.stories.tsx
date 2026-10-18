import type { Meta, StoryObj } from "@storybook/react-vite"
import { IconAward } from "@tabler/icons-react"
import { useState } from "react"
import { Avatar, AvatarFallback } from "../components/avatar"
import { Badge } from "../components/badge"
import { Button } from "../components/button"
import {
  Callout,
  CalloutContent,
  CalloutDescription,
  CalloutMedia,
  CalloutTitle,
} from "../components/callout"
import { Card, CardContent, CardHeader, CardTitle } from "../components/card"
import { Checkbox } from "../components/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "../components/field"
import { FlagIcon } from "../components/flag-icon"
import { Input } from "../components/input"
import {
  PageHeader,
  PageHeaderDescription,
  PageHeaderHeading,
  PageHeaderTitle,
} from "../components/page-header"
import { PulseDot } from "../components/pulse-dot"
import { Spinner } from "../components/spinner"
import { Stat, StatLabel, StatValue } from "../components/stat"
import { Step, Steps } from "../components/steps"
import { TextLink } from "../components/text-link"
import { TierBadge } from "../components/tier-badge"
import type { Tier } from "../lib/tiers"

function SignInForm() {
  return (
    <form
      className="flex flex-col gap-5 rounded-xl border bg-card p-8"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-5xl font-bold">Sign in</h1>
        <span className="text-muted-foreground">[YOUR COMMUNITY] stats account</span>
      </div>
      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <TextLink href="#" className="text-xs">
              Forgot password?
            </TextLink>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </Field>
        <Field orientation="horizontal">
          <Checkbox id="remember" />
          <FieldLabel htmlFor="remember" className="font-normal text-muted-foreground">
            Keep me signed in
          </FieldLabel>
        </Field>
        <Button type="submit" className="w-full">
          Sign in
        </Button>
        <FieldSeparator>or</FieldSeparator>
        <Button type="button" variant="secondary" className="w-full">
          Create an account
        </Button>
        <FieldDescription className="text-center text-xs">
          Admins: use your admin credentials. 2FA is required for admin roles.
        </FieldDescription>
      </FieldGroup>
    </form>
  )
}

function SignInAside() {
  return (
    <aside className="flex flex-col gap-6 pt-2">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-semibold">With an account</h2>
        <p className="text-muted-foreground">
          Your kills are logged whether you sign in or not. An account links them to you and keeps
          them through name changes.
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {[
          ["Your row, pinned.", "See where you stand on every leaderboard without scrolling."],
          ["Tier progress and awards.", "Track skill to the next tier, streaks and the 24 awards."],
          ["Weekly digest.", "Rank change, nemesis report and the award you are closest to."],
        ].map(([title, body], i) => (
          <li key={title} className="flex items-start gap-3">
            <span className="inline-flex size-7 shrink-0 items-center justify-center border border-primary-bright/50 text-sm font-bold text-primary-bright">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>
              <strong className="font-semibold">{title}</strong>{" "}
              <span className="text-muted-foreground">{body}</span>
            </span>
          </li>
        ))}
      </ol>
      <Callout>
        <CalloutContent>
          <CalloutDescription>
            Already play here? Claim takes one chat command in game.
          </CalloutDescription>
        </CalloutContent>
        <TextLink href="#" className="font-semibold">
          Claim your player
        </TextLink>
      </Callout>
    </aside>
  )
}

const matches = [
  ["Aether", "th", "Thailand", "veteran", 12, "Seen now · Bangkok 24/7 Dust2 · 214 h"],
  ["AetherMaster", "th", "Thailand", "recruit", 1420, "Seen 6 d ago · Deathmatch Arena · 3 h"],
  ["aeth_", "sg", "Singapore", "regular", 388, "Seen 22 d ago · Bangkok Classic Maps · 19 h"],
] as const

function ClaimFlow({ initialStep = 1 }: { initialStep?: 1 | 2 | 3 }) {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep)
  const [picked, setPicked] = useState(0)
  const player = matches[picked] ?? matches[0]

  return (
    <div className="flex flex-col gap-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageHeaderTitle>Claim your player</PageHeaderTitle>
          <PageHeaderDescription>
            Three steps, about a minute. You need to be on one of our servers for step 2.
          </PageHeaderDescription>
        </PageHeaderHeading>
      </PageHeader>
      <Steps aria-label="Progress">
        <Step status={step > 1 ? "complete" : "current"}>Find your player</Step>
        <Step status={step > 2 ? "complete" : step === 2 ? "current" : "upcoming"}>
          Verify in game
        </Step>
        <Step status={step === 3 ? "current" : "upcoming"}>Unlocked</Step>
      </Steps>
      <Card className="min-h-105 gap-5">
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>Step 1 · Find your player</CardTitle>
              <span className="text-muted-foreground">
                Search by the name you use in game. Names seen in the last 30 days are listed first.
              </span>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="ign">In-game name</FieldLabel>
                <Input id="ign" type="search" defaultValue="aeth" placeholder="Type your name" />
              </Field>
            </CardContent>
            <CardContent className="flex flex-col border-t">
              {matches.map(([name, cc, country, tier, rank, meta], i) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setPicked(i)
                    setStep(2)
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 border-b px-3 py-2.5 text-left hover:bg-accent"
                >
                  <Avatar shape="square">
                    <AvatarFallback className="text-sm">
                      {name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <FlagIcon code={cc} name={country} />
                      {name}
                      <TierBadge tier={tier as Tier} />
                    </span>
                    <span className="text-xs text-muted-foreground">{meta}</span>
                  </span>
                  <span className="text-muted-foreground tabular-nums">#{rank}</span>
                </button>
              ))}
            </CardContent>
            <CardContent className="text-xs text-muted-foreground">
              Not listed? Join any server, play one round, then search again.
            </CardContent>
          </>
        )}
        {step === 2 && (
          <>
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardTitle>Step 2 · Verify in game</CardTitle>
                <span className="text-muted-foreground">
                  Claiming <strong className="font-bold text-foreground">{player[0]}</strong> · #
                  {player[4]}
                </span>
              </div>
              <Button variant="ghost" onClick={() => setStep(1)}>
                Change player
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <span className="font-medium">Open chat on any of our servers and type:</span>
              <div className="flex flex-wrap items-center justify-between gap-4 border border-primary-bright/50 bg-background px-6 py-5">
                <code className="text-4xl font-bold tracking-wide text-primary-bright">
                  /claim 7F2K-91
                </code>
                <Button variant="secondary">Copy</Button>
              </div>
              <span className="text-xs text-muted-foreground">
                Code expires in 9:41. Only the player typing it gets linked, so keep it to yourself.
              </span>
            </CardContent>
            <CardContent className="flex items-center gap-3 border-t pt-4 text-muted-foreground">
              <Spinner className="text-muted-foreground" />
              Waiting for you in game. Last seen:{" "}
              <strong className="font-bold text-foreground">Bangkok 24/7 Dust2</strong>, 41 s ago.
            </CardContent>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => setStep(3)}>I typed it</Button>
              <Button variant="secondary">Find a server</Button>
            </CardContent>
          </>
        )}
        {step === 3 && (
          <>
            <CardHeader className="gap-1">
              <Badge variant="live" className="self-start">
                <PulseDot />
                Verified
              </Badge>
              <h2 className="text-3xl font-semibold">{player[0]} is yours.</h2>
              <span className="text-muted-foreground">
                Linked at 21:52 from Bangkok 24/7 Dust2. Your row is pinned on every leaderboard.
              </span>
            </CardHeader>
            <CardContent>
              <Callout variant="accent" className="justify-start">
                <CalloutMedia className="border-primary-bright/50 text-primary-bright">
                  <IconAward />
                </CalloutMedia>
                <CalloutContent>
                  <CalloutTitle className="text-base font-bold">
                    Award unlocked · Enlisted
                  </CalloutTitle>
                  <CalloutDescription>
                    Your first award. 23 to go. The next one within reach: Bomb Squad, 7 / 10.
                  </CalloutDescription>
                </CalloutContent>
              </Callout>
            </CardContent>
            <CardContent className="grid grid-cols-3 gap-3">
              <Stat>
                <StatLabel>Rank</StatLabel>
                <StatValue>#{player[4]}</StatValue>
              </Stat>
              <Stat>
                <StatLabel>Tier</StatLabel>
                <StatValue className="text-tier-veteran capitalize">{player[3]}</StatValue>
              </Stat>
              <Stat>
                <StatLabel>To next tier</StatLabel>
                <StatValue>158</StatValue>
              </Stat>
            </CardContent>
            <CardContent className="flex flex-wrap gap-2 border-t pt-4">
              <Button>Go to my profile</Button>
              <Button variant="secondary">See my row on the leaderboard</Button>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}

const meta = {
  title: "Patterns/Account",
  parameters: { layout: "padded" },
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

export const SignIn: Story = {
  render: () => (
    <div className="grid w-4xl grid-cols-[repeat(auto-fit,minmax(360px,1fr))] items-start gap-12">
      <SignInForm />
      <SignInAside />
    </div>
  ),
}

export const ClaimStep1: Story = {
  name: "Claim · step 1",
  render: () => (
    <div className="w-3xl">
      <ClaimFlow />
    </div>
  ),
}

export const ClaimStep2: Story = {
  name: "Claim · step 2",
  render: () => (
    <div className="w-3xl">
      <ClaimFlow initialStep={2} />
    </div>
  ),
}

export const ClaimStep3: Story = {
  name: "Claim · step 3",
  render: () => (
    <div className="w-3xl">
      <ClaimFlow initialStep={3} />
    </div>
  ),
}
