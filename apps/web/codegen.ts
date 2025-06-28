import { CodegenConfig } from "@graphql-codegen/cli"

const config: CodegenConfig = {
  schema: "http://localhost:4000/graphql",
  documents: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
  generates: {
    "./lib/gql/": {
      preset: "client",
      plugins: [],
    },
  },
}

export default config
