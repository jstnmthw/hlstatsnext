import SchemaBuilder from "@pothos/core"
import PrismaPlugin from "@pothos/plugin-prisma"
import type PrismaTypes from "@/generated/graphql/pothos-types"
import { db } from "@repo/database/client"

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes
}>({
  plugins: [PrismaPlugin],
  prisma: {
    // The prisma client to use
    client: db,
  },
})

// Add base types
builder.queryType({})

// Add mutation type with a placeholder field
builder.mutationType({
  fields: (t) => ({
    // Placeholder mutation - will be replaced with actual mutations later
    _placeholder: t.string({
      resolve: () => "Mutations will be implemented in future phases",
    }),
  }),
})

// Add subscription type with a placeholder field
builder.subscriptionType({
  fields: (t) => ({
    // Placeholder subscription - will be replaced with actual subscriptions later
    _placeholder: t.string({
      subscribe: () => {
        // Simple async generator that yields once
        return (async function* () {
          yield "Subscriptions will be implemented in future phases"
        })()
      },
      resolve: (value) => value,
    }),
  }),
})
