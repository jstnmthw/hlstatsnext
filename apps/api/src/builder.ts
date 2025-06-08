import SchemaBuilder from "@pothos/core";
import PrismaPlugin from "@pothos/plugin-prisma";
import RelayPlugin from "@pothos/plugin-relay";
import WithInputPlugin from "@pothos/plugin-with-input";
import { db } from "@repo/database/client";
import type PrismaTypes from "@repo/database/graphql/types";
import type { Context } from "./context";

export const builder = new SchemaBuilder<{
  Context: Context;
  PrismaTypes: PrismaTypes;
}>({
  plugins: [PrismaPlugin, RelayPlugin, WithInputPlugin],
  prisma: {
    client: db,
    // defaults to false, uses /// comments from prisma schema as descriptions
    // for object types, relations and exposed fields.
    // descriptions can be omitted by setting description to false
    exposeDescriptions: true,
    // use where clause from prismaRelatedConnection for totalCount (defaults to true)
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
