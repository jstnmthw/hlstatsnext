import { Prisma } from "@repo/database"
import SchemaBuilder from "@pothos/core"
import PrismaPlugin from "@pothos/plugin-prisma"
import { db, GraphQLTypes } from "@repo/database"
// import { Context } from './src/context';

type PrismaTypes = typeof GraphQLTypes

export const builder = new SchemaBuilder<{
  // Context: Context;
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
