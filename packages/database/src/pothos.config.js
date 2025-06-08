/* eslint-disable */

/** @type {import('prisma-generator-pothos-codegen').Config} */

module.exports = {
  inputs: {
    outputFilePath: "./generated/graphql/pothos-inputs.ts",
    prismaImporter: `import { db } from "../../src";`,
    prismaCaller: "db",
  },
  crud: {
    outputDir: "./generated/graphql/pothos-inputs",
    inputsImporter: `import * as Inputs from '../../../../generated/graphql/pothos-inputs';`,
    resolverImports: `\nimport { db } from "../../../../../src";`,
    prismaCaller: "db",
  },
  global: {
    builderLocation: "../../apps/api/src/builder",
  },
};
