import type { TransactionalPrisma } from "@/database/client"

/** Build only the delegates you need while still satisfying TransactionalPrisma */
export function prismaPartialMock<
  T extends Partial<TransactionalPrisma>,
>(partial: T): T & TransactionalPrisma {
  // the cast is safe – we're asserting the object IS that subset
  return partial as T & TransactionalPrisma
}