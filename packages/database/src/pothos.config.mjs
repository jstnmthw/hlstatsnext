/** @type {import('prisma-generator-pothos-codegen').Config} */
export const crud = {
  outputDir: "./generated/graphql/pothos-inputs",
  inputsImporter: `import * as Inputs from '../../../../generated/graphql/pothos-inputs';`,
  resolverImports: `\nimport { db } from "@repo/database/client";`,
  prismaImporter: `import { Prisma } from "@repo/database/client";`,
  prismaCaller: "db",
}

export const inputs = {
  outputFilePath: "./generated/graphql/pothos-inputs.ts",
  prismaImporter: `import { Prisma } from "@repo/database/client";`,
}

export const global = {
  builderLocation: "../../apps/api/src/builder",
  replacer: (generated) => {
    return `// @ts-nocheck\n${generated}`
  },
}
