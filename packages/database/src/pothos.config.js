/** @type {import('prisma-generator-pothos-codegen').Config} */

const generatedGqlDir = "./generated/graphql"

export const inputs = {
  outputFilePath: `${generatedGqlDir}/pothos-inputs.ts`,
  prismaImporter: 'import { Prisma } from "@prisma/client";',
}

export const crud = {
  outputDir: `${generatedGqlDir}/pothos-inputs`,
  inputsImporter: "import * as Inputs from '../pothos-inputs';",
  resolverImports: '\nimport { db } from "../../../src/client";',
  prismaImporter: 'import { Prisma } from "@prisma/client";',
  prismaCaller: "db",
  builderLocation: "@repo/builder",
}

export const global = {
  replacer: (generated) => {
    return `/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
/* eslint-disable */\n${generated}`
  },
}
