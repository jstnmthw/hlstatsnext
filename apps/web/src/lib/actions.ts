/**
 * What every server action returns. Guards redirect or 404 before an action
 * gets this far, so the result only describes the work itself.
 */
export type ActionResult<T = undefined> =
  | { ok: true; message: string; data?: T; errors?: undefined }
  | { ok: false; message: string; errors?: Record<string, string[]> }

/** Initial state for `useActionState`. */
export const idleActionState: ActionResult<never> = { ok: true, message: "" }
