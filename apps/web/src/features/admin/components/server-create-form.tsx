"use client"

import { useActionState } from "react"
import { useFormStatus } from "react-dom"
import { createServer } from "@/features/admin/actions/create-server"
import {
  FormField,
  Label,
  TextInput,
  NumberInput,
  SelectInput,
  ErrorMessage,
} from "@/features/admin/components/form-inputs"
import { Button } from "@repo/ui/button"

function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} variant="solid" colorScheme="green" className="w-full">
      {pending ? "Creating Server..." : "Create Server"}
    </Button>
  )
}

export function ServerCreateForm() {
  const [state, formAction] = useActionState(createServer, { success: true, message: "" })

  return (
    <form action={formAction} className="space-y-6">
      {!state.success && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 text-sm">{state.message}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <FormField>
          <Label htmlFor="name" required>
            Server Name
          </Label>
          <TextInput
            id="name"
            name="name"
            placeholder="My Counter-Strike Server"
            required
            maxLength={100}
          />
          {state.errors?.name && <ErrorMessage>{state.errors.name[0]}</ErrorMessage>}
        </FormField>

        <FormField>
          <Label htmlFor="game">Game Type</Label>
          <SelectInput id="game" name="game" defaultValue="cstrike">
            <option value="cstrike">Counter-Strike</option>
            <option value="cstrike2">Counter-Strike 2</option>
            <option value="tf">Team Fortress Classic</option>
            <option value="dod">Day of Defeat</option>
            <option value="hl">Half-Life</option>
          </SelectInput>
          {state.errors?.game && <ErrorMessage>{state.errors.game[0]}</ErrorMessage>}
        </FormField>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <FormField>
          <Label htmlFor="address" required>
            Server Address
          </Label>
          <TextInput
            id="address"
            name="address"
            placeholder="192.168.1.100"
            required
            maxLength={255}
          />
          {state.errors?.address && <ErrorMessage>{state.errors.address[0]}</ErrorMessage>}
        </FormField>

        <FormField>
          <Label htmlFor="port" required>
            Port
          </Label>
          <NumberInput
            id="port"
            name="port"
            placeholder="27015"
            defaultValue={27015}
            min={1}
            max={65535}
            required
          />
          {state.errors?.port && <ErrorMessage>{state.errors.port[0]}</ErrorMessage>}
        </FormField>
      </div>

      <FormField>
        <Label htmlFor="rconPassword">RCON Password</Label>
        <TextInput
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
