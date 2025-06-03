import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import RelayPlugin from "@pothos/plugin-relay";
import { db } from "@repo/database/client";
import type PrismaTypes from "@repo/database/generated/graphql";
import type { Context } from "./context";

export const builder = new SchemaBuilder<{
  Context: Context;
  PrismaTypes: PrismaTypes;
}>({
  plugins: [PrismaPlugin, RelayPlugin],
  prisma: {
    client: db,
    // Use where clauses from prismaClient for @pothos/plugin-prisma
    filterConnectionTotalCount: true,
    // warn when not using a query parameter correctly
    onUnusedQuery: process.env.NODE_ENV === "production" ? null : "warn",
  },
});

// Add base types
builder.queryType({});

// Add mutation type with a placeholder field
builder.mutationType({
  fields: (t) => ({
    // Placeholder mutation - will be replaced with actual mutations later
    _placeholder: t.string({
      resolve: () => "Mutations will be implemented in future phases",
    }),
  }),
});

// Add subscription type with a placeholder field
builder.subscriptionType({
  fields: (t) => ({
    // Placeholder subscription - will be replaced with actual subscriptions later
    _placeholder: t.string({
      subscribe: () => {
        // Simple async generator that yields once
        return (async function* () {
          yield "Subscriptions will be implemented in future phases";
        })();
      },
      resolve: (value) => value,
    }),
  }),
});
