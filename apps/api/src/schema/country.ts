import { builder } from "../builder";

// Define Country object using Prisma plugin
const Country = builder.prismaObject("Country", {
  fields: (t) => ({
    // Expose all database fields
    flag: t.exposeString("flag"),
    name: t.exposeString("name"),

    // Add GraphQL id field mapped to flag
    id: t.string({
      resolve: (country) => country.flag,
    }),

    // Expose relation counts
    playerCount: t.relationCount("players"),
  }),
});

// Query to get all countries
builder.queryField("countries", (t) =>
  t.prismaField({
    type: [Country],
    resolve: async (query, _parent, _args, context) => {
      return context.db.country.findMany({
        ...query,
        orderBy: { name: "asc" },
      });
    },
  }),
);

// Query to get a single country by id
builder.queryField("country", (t) =>
  t.prismaField({
    type: Country,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (query, _parent, args, context) => {
      return context.db.country.findUnique({
        ...query,
        where: { flag: args.id },
      });
    },
  }),
);

export { Country };
