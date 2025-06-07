/* eslint-disable */

/** @type {import('prisma-generator-pothos-codegen').Config} */

module.exports = {
  inputs: {
    outputFilePath: "./generated/graphql/pothos-input.ts",
  },
  crud: {
    outputDir: "./generated/graphql/pothos-types",
    inputsImporter: `import * as Inputs from './generated/graphql/pothos-input';`,
    resolverImports: `import prisma from './generated/prisma';`,
    prismaCaller: "prisma",
    global: {},
  },
  global: {},
};
