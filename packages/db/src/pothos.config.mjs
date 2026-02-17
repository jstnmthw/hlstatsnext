/** @type {import('prisma-generator-pothos-codegen').Config} */
export const crud = {
  outputDir: "./generated/graphql/pothos-inputs",
  inputsImporter: `import * as Inputs from '../../../../generated/graphql/pothos-inputs';`,
  resolverImports: `\nimport { db } from "@repo/db/client";`,
  prismaImporter: `import { Prisma } from "@repo/db/client";`,
  prismaCaller: "db",
}

export const inputs = {
  outputFilePath: "./generated/graphql/pothos-inputs.ts",
  prismaImporter: `import { Prisma } from "@repo/db/client";`,
}

export const global = {
  builderLocation: "../../apps/api/src/builder",
  replacer: (generated) => {
    return `// @ts-nocheck\n${generated}`
  },
}
