import SchemaBuilder from "@pothos/core"
import PrismaPlugin from "@pothos/plugin-prisma"
import RelayPlugin from "@pothos/plugin-relay"
import WithInputPlugin from "@pothos/plugin-with-input"
import { db, Prisma } from "@repo/database/client"
import type PrismaTypes from "@repo/database/graphql/types"
import { getDatamodel } from "@repo/database/graphql/types"
import type { Context } from "./context"

export const builder = new SchemaBuilder<{
  Context: Context
  PrismaTypes: PrismaTypes
  Scalars: {
    Decimal: { Input: Prisma.Decimal; Output: Prisma.Decimal }
    DateTime: { Input: Date; Output: Date }
    Json: { Input: Prisma.InputJsonValue; Output: Prisma.JsonValue }
  }
}>({
  plugins: [PrismaPlugin, RelayPlugin, WithInputPlugin],
  prisma: {
    client: db,
    dmmf: getDatamodel(),
    exposeDescriptions: true,
    onUnusedQuery: process.env.NODE_ENV === "production" ? null : "warn",
  },
})

// Add types
builder.queryType({})

// Add mutations
// builder.mutationType({})

// Add subscriptions
// builder.subscriptionType({})
