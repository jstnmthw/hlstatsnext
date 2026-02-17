import { FilterTransform } from "@/features/common/graphql/pagination"

/**
 * Converts virtual status filter values ("active", "banned", "unverified")
 * into GraphQL where-clause fragments. Multiple statuses are OR'd together.
 */
export const statusFilterTransform: FilterTransform = (values) => {
  const clauses: Array<Record<string, unknown>> = []

  for (const value of values) {
    switch (value) {
      case "active":
        clauses.push({ banned: { not: { equals: true } }, emailVerified: { equals: true } })
        break
      case "banned":
        clauses.push({ banned: { equals: true } })
        break
      case "unverified":
        clauses.push({ emailVerified: { equals: false }, banned: { not: { equals: true } } })
        break
    }
  }

  if (clauses.length === 0) return undefined
  if (clauses.length === 1) return clauses[0]
  return { OR: clauses }
}
