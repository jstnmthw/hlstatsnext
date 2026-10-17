"use client"

import { authErrorMessage } from "@/features/auth/lib/auth-error-messages"
import type { AccountOverview, LinkedAccount } from "@/lib/account"
import { authClient } from "@repo/auth/client"
import { Button, IconBrandGoogle, IconBrandSteam, IconKey } from "@repo/ui"
import { useRouter } from "next/navigation"
import { useState, type ComponentType } from "react"

interface ConnectedAccountsProps {
  overview: AccountOverview
  googleEnabled: boolean
  /** Carried back by a Steam or Google link callback as ?error=CODE. */
  errorCode?: string
}

export function ConnectedAccounts({ overview, googleEnabled, errorCode }: ConnectedAccountsProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(() =>
    errorCode
      ? authErrorMessage(errorCode, "Connecting the account failed. Please try again.")
      : "",
  )
  // Better Auth refuses to unlink the last way in, so the button only shows when another remains.
  const canDisconnect = overview.signInMethods > 1

  async function run(
    action: () => Promise<{ error?: { code?: string; message?: string } | null }>,
  ) {
    setBusy(true)
    setError("")
    const { error: actionError } = await action()
    if (actionError) {
      setError(authErrorMessage(actionError.code, actionError.message ?? "Something went wrong."))
      setBusy(false)
      return false
    }
    return true
  }

  // Connect calls redirect away on success; disconnect stays on the page.
  const connectSteam = () =>
    run(() =>
      authClient.steam.link({
        callbackURL: "/accounts/settings",
        errorCallbackURL: "/accounts/settings",
      }),
    )
  const connectGoogle = () =>
    run(() => authClient.linkSocial({ provider: "google", callbackURL: "/accounts/settings" }))
  const disconnect = async (account: LinkedAccount) => {
    const ok = await run(() => authClient.unlinkAccount({ accountId: account.id }))
    if (ok) {
      setBusy(false)
      router.refresh()
    }
  }

  const passwordDetail = overview.hasPassword
    ? "Set"
    : overview.emailVerified
      ? "Not set. Use “Forgot password” on the sign-in page to create one."
      : "Not set. Add a verified email first."

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-destructive">{error}</div>
      )}

      <AccountRow
        icon={IconBrandSteam}
        title="Steam"
        detail={overview.steam ? `SteamID ${overview.steam.accountId}` : "Not connected"}
        action={
          overview.steam ? (
            canDisconnect && (
              <DisconnectButton account={overview.steam} busy={busy} onClick={disconnect} />
            )
          ) : (
            <Button
              size="sm"
              variant="outline"
              colorScheme="zinc"
              onClick={connectSteam}
              disabled={busy}
            >
              Connect
            </Button>
          )
        }
      />

      {googleEnabled && (
        <AccountRow
          icon={IconBrandGoogle}
          title="Google"
          detail={overview.google ? "Connected" : "Not connected"}
          action={
            overview.google ? (
              canDisconnect && (
                <DisconnectButton account={overview.google} busy={busy} onClick={disconnect} />
              )
            ) : (
              <Button
                size="sm"
                variant="outline"
                colorScheme="zinc"
                onClick={connectGoogle}
                disabled={busy}
              >
                Connect
              </Button>
            )
          }
        />
      )}

      <AccountRow icon={IconKey} title="Password" detail={passwordDetail} />
    </div>
  )
}

function AccountRow({
  icon: Icon,
  title,
  detail,
  action,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  detail: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </div>
      {action}
    </div>
  )
}

function DisconnectButton({
  account,
  busy,
  onClick,
}: {
  account: LinkedAccount
  busy: boolean
  onClick: (account: LinkedAccount) => void
}) {
  return (
    <Button size="sm" variant="ghost" onClick={() => onClick(account)} disabled={busy}>
      Disconnect
    </Button>
  )
}
