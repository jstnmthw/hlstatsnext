export type UserListItem = {
  id?: string | null
  name?: string | null
  email?: string | null
  emailVerified?: boolean | null
  role?: string | null
  banned?: boolean | null
  banReason?: string | null
  banExpires?: string | Date | null
  image?: string | null
  createdAt?: string | Date | null
  updatedAt?: string | Date | null
  __typename?: string
}
