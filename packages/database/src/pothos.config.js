/* eslint-disable */

/** @type {import('prisma-generator-pothos-codegen').Config} */

module.exports = {
  inputs: {
    outputFilePath: "./generated/graphql/pothos-input.ts",
  },
  crud: {
    outputDir: "./generated/graphql/pothos-input",
    inputsImporter: `import * as Inputs from '../../../../generated/graphql/pothos-input';`,
    resolverImports: `\nimport { db } from "../../../../../src";`,
    prismaCaller: "db",
  },
  global: {
    builderLocation: "../../apps/api/src/builder",
  },
};
