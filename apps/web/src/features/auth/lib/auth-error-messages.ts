const messages: Record<string, string> = {
  SESSION_NOT_FRESH: "For your security, sign in again before changing this.",
  STEAM_VERIFICATION_FAILED: "Steam could not confirm your sign-in. Please try again.",
  STEAM_AUTHENTICATION_FAILED: "Steam sign-in failed. Please try again.",
  STEAM_ACCOUNT_ALREADY_LINKED: "That Steam account is already connected to a different user.",
  STEAM_ACCOUNT_NOT_LINKED: "No account is connected to that Steam profile yet.",
  STEAM_UNABLE_TO_LINK_ACCOUNT: "Steam could not be connected. Please try again.",
  STEAM_ACCOUNT_LINKING_DISABLED: "Connecting accounts is turned off.",
  STEAM_DIFFERENT_EMAIL_LINKING_DISABLED: "Connecting accounts is turned off.",
  state_mismatch: "The sign-in request expired. Please start again.",
  state_not_found: "The sign-in request expired. Please start again.",
}

/** A sentence for an error code Better Auth or the Steam plugin reports, or the fallback. */
export function authErrorMessage(code: string | null | undefined, fallback: string): string {
  if (!code) return fallback
  return messages[code] ?? fallback
}
