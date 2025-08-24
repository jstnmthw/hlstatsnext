"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { createServer } from "@/features/admin/actions/create-server"
import { FormField, ErrorMessage } from "@/features/admin/components/form"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Label,
} from "@repo/ui"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} variant="solid" colorScheme="green" className="w-full">
      {pending ? "Creating Server..." : "Create Server"}
    </Button>
  )
}

function ErrorDisplay({ state }: { state: { success: boolean; message: string } }) {
  const { pending } = useFormStatus()

  // Don't render anything if there's no error message
  if (state.success || !state.message) {
    return null
  }

  return (
    <div
      className={`px-3 py-2 border rounded-md !border-red-500/20 flex items-center justify-between transition-opacity duration-200 ${
        pending ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <p className="text-red-800 text-sm dark:text-red-500">{state.message}</p>
    </div>
  )
}

export function ServerCreateForm() {
  const [state, formAction] = useActionState(createServer, { success: true, message: "" })

  return (
    <form action={formAction} className="space-y-6">
      <pre className="text-xs text-muted-foreground">{JSON.stringify(state, null, 2)}</pre>
      <ErrorDisplay state={state} />

      <div className="grid gap-6 md:grid-cols-2">
        <FormField>
          <Label htmlFor="game">Game Type</Label>
          <Select name="game" defaultValue="cstrike">
            <SelectTrigger id="game" className="w-1/2">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cstrike">Counter-Strike</SelectItem>
              <SelectItem value="cstrike2">Counter-Strike 2</SelectItem>
              <SelectItem value="tf">Team Fortress Classic</SelectItem>
              <SelectItem value="dod">Day of Defeat</SelectItem>
              <SelectItem value="hl">Half-Life</SelectItem>
            </SelectContent>
          </Select>
          {state.errors?.game && <ErrorMessage>{state.errors.game[0]}</ErrorMessage>}
        </FormField>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <FormField>
          <Label htmlFor="address" required>
            Server Address
          </Label>
          <Input id="address" name="address" placeholder="192.168.1.100" required maxLength={255} />
          {state.errors?.address && <ErrorMessage>{state.errors.address[0]}</ErrorMessage>}
        </FormField>

        <FormField>
          <Label htmlFor="port" required>
            Port
          </Label>
          <Input
            id="port"
            name="port"
            type="number"
            placeholder="27015"
            min={1}
            max={65535}
            required
          />
          {state.errors?.port && <ErrorMessage>{state.errors.port[0]}</ErrorMessage>}
        </FormField>
      </div>

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
          Optional. Used for remote server administration and real-time monitoring.
        </p>
        {state.errors?.rconPassword && <ErrorMessage>{state.errors.rconPassword[0]}</ErrorMessage>}
      </FormField>

      <div className="flex gap-4 pt-6">
        <SubmitButton />
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
