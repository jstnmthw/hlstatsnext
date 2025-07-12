import { db } from "@repo/database"
import { Prisma } from "@repo/database"
import SchemaBuilder from "@pothos/core"
import PrismaPlugin from "@pothos/plugin-prisma"
import PrismaTypes from "@/generated/graphql/pothos-types"

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes
  Scalars: {
    Decimal: { Input: Prisma.Decimal; Output: Prisma.Decimal }
    DateTime: { Input: Date; Output: Date }
    Json: { Input: Prisma.InputJsonValue; Output: Prisma.JsonValue }
  }
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: db,
  },
})
