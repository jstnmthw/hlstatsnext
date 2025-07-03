/** @type {import('prisma-generator-pothos-codegen').Config} */
import { readFileSync, writeFileSync } from "fs"
import { glob } from "glob"

export const inputs = {
  outputFilePath: `./src/generated/graphql/pothos-inputs.ts`,
  prismaImporter: `import { db } from "../../client";`,
  prismaCaller: "db",
}
export const crud = {
  outputDir: `./src/generated/graphql/pothos-crud`,
  inputsImporter: `import * as Inputs from "../../pothos-inputs";`,
  resolverImports: `\nimport { db } from "../../../client";`,
  builderImporter: `import { builder } from "../../builder";`,
  prismaImporter: `import { db } from "../../../client";`,
  prismaCaller: "db",
}

export const global = {
  builderLocation: "@/builder",
  afterGenerate: () => {
    // Get all generated files that might contain the incorrect import
    const files = glob.sync(`./src/generated/graphql/pothos-crud/**/*.ts`)

    // Define the regular expression to find and replace the incorrect builder import
    const wrongBuilderImportRegex =
      /import { builder } from ['"]([\.\/]+builder|[\.\/]*@\/builder)['"];/g
    const correctBuilderImport = "import { builder } from '../../../builder';"

    // NEW: Define regex to fix the inputs import issue
    const wrongInputsImportRegex = /import \* as Inputs from ["']([\.\/]+)pothos-inputs["'];/g
    const correctInputsImport = `import * as Inputs from "../../pothos-inputs";`

    // Loop through each file and fix the imports
    for (const file of files) {
      let content = readFileSync(file, "utf8")
      let modified = false

      if (wrongBuilderImportRegex.test(content)) {
        content = content.replace(wrongBuilderImportRegex, correctBuilderImport)
        modified = true
      }

      // NEW: Fix inputs imports
      if (wrongInputsImportRegex.test(content)) {
        content = content.replace(wrongInputsImportRegex, correctInputsImport)
        modified = true
      }

      if (modified) {
        writeFileSync(file, content, "utf8")
      }
    }
  },
}
