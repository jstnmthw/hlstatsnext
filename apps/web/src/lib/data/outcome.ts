/** What a data-module write reports back to the action that asked for it. */
export interface MutationOutcome {
  ok: boolean
  message: string | null
}
