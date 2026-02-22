"use client"

import type { TokenOperationResult } from "@/features/admin/tokens/actions/create-token"
import { createToken } from "@/features/admin/tokens/actions/create-token"
import { ErrorDisplay, ErrorMessage, FormField } from "@/features/common/components/form"
import type { Game } from "@repo/db/client"
import { BasicSelect, Button, Input, Label } from "@repo/ui"
import { useActionState, useState } from "react"

type GameProps = Pick<Game, "code" | "name">

export function TokenCreateForm({ games }: { games: GameProps[] }) {
  const [state, formAction, pending] = useActionState(createToken, {
    success: true,
    message: "",
  } as TokenOperationResult)

  const [copied, setCopied] = useState(false)

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(token)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Show the raw token after successful creation
  if (state.success && state.rawToken) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-green-500/20 bg-green-500/5 p-4">
          <p className="mb-2 text-sm font-medium text-green-400">Token created successfully!</p>
          <p className="mb-4 text-xs text-muted-foreground">
            Copy this token now. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-zinc-800 px-3 py-2 font-mono text-xs break-all">
              {state.rawToken}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleCopy(state.rawToken!)}
            >
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        </div>
        <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-4">
          <p className="mb-2 text-sm font-medium">Plugin Configuration</p>
          <p className="mb-2 text-xs text-muted-foreground">
            Add this to your game server&apos;s config file:
          </p>
          <code className="block rounded bg-zinc-900 px-3 py-2 font-mono text-xs">
            hlx_token &quot;{state.rawToken}&quot;
          </code>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => (window.location.href = "/admin/tokens")}
        >
          Back to Tokens
        </Button>
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-6">
      <ErrorDisplay state={state} pending={pending} />

      <FormField>
        <Label htmlFor="name" required>
          Token Name
        </Label>
        <Input
          id="name"
          name="name"
          placeholder="e.g. Production Server Fleet"
          maxLength={128}
          required
        />
        <p className="text-xs text-muted-foreground">A descriptive name to identify this token.</p>
        {state.errors?.name && <ErrorMessage>{state.errors.name[0]}</ErrorMessage>}
      </FormField>

      <FormField>
        <Label htmlFor="game" required>
          Game Type
        </Label>
        <BasicSelect name="game" defaultValue="cstrike" required>
          {games.map((game) => (
            <option key={game.code} value={game.code}>
              {game.name}
            </option>
          ))}
        </BasicSelect>
        <p className="text-xs text-muted-foreground">
          Determines the log parser and RCON protocol for servers using this token.
        </p>
        {state.errors?.game && <ErrorMessage>{state.errors.game[0]}</ErrorMessage>}
      </FormField>

      <FormField>
        <Label htmlFor="rconPassword">RCON Password</Label>
        <Input
          id="rconPassword"
          name="rconPassword"
          type="password"
          placeholder="Optional remote console password"
          maxLength={255}
        />
        <p className="text-xs text-muted-foreground">
          Servers authenticated with this token will use this RCON password by default. Without
          RCON, server monitoring (hostname, map, player count) will be unavailable.
        </p>
        {state.errors?.rconPassword && <ErrorMessage>{state.errors.rconPassword[0]}</ErrorMessage>}
      </FormField>

      <FormField>
        <Label htmlFor="expiresAt">Expiration Date</Label>
        <Input id="expiresAt" name="expiresAt" type="datetime-local" />
        <p className="text-xs text-muted-foreground">
          Optional. Leave empty for a token that never expires.
        </p>
        {state.errors?.expiresAt && <ErrorMessage>{state.errors.expiresAt[0]}</ErrorMessage>}
      </FormField>

      <div className="flex gap-4 pt-6">
        <Button
          type="submit"
          disabled={pending}
          variant="solid"
          colorScheme="green"
          className="w-full"
        >
          {pending ? "Creating Token..." : "Create Token"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => window.history.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
