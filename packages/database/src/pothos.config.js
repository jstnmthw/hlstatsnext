/** @type {import('prisma-generator-pothos-codegen').Config} */
export const inputs = {
  outputFilePath: "./generated/graphql/pothos-inputs.ts",
  prismaImporter: `import { Prisma } from "../../src";`,
}
export const crud = {
  outputDir: "./generated/graphql/pothos-inputs",
  inputsImporter: `import * as Inputs from '../../../../generated/graphql/pothos-inputs';`,
  resolverImports: `\nimport { db } from "../../../../../src";`,
  prismaImporter: `import { Prisma } from "../../../src";`,
  prismaCaller: "db",
}
export const global = {
  builderLocation: "../../apps/api/src/builder",
  replacer: (generated) => {
    return `/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable */\n${generated}`
  },
}
