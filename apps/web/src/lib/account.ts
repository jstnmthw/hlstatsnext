export interface LinkedAccount {
  /** Better Auth's own row id, which unlinkAccount expects. */
  id: string
  providerId: string
  /** The provider's identifier: the SteamID64 for Steam. */
  accountId: string
}

export interface AccountOverview {
  email: string
  emailVerified: boolean
  hasPassword: boolean
  steam: LinkedAccount | null
  google: LinkedAccount | null
  /** Better Auth refuses to unlink the last remaining way in. */
  signInMethods: number
}
