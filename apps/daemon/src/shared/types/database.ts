/**
 * Database-related types shared across modules
 */

export interface DatabaseTransaction {
  // Transaction interface that matches Prisma's transaction type
  [key: string]: unknown
}

export interface RepositoryOptions {
  transaction?: DatabaseTransaction
}

export interface CreateOptions extends RepositoryOptions {
  validateInput?: boolean
}

export interface UpdateOptions extends RepositoryOptions {
  validateInput?: boolean
  upsert?: boolean
}

export interface FindOptions extends RepositoryOptions {
  include?: Record<string, unknown>
  select?: Record<string, unknown>
}

export interface QueryOptions extends FindOptions {
  limit?: number
  offset?: number
  orderBy?: Record<string, "asc" | "desc">
}
