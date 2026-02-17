// PostCSS configuration with monorepo base path for UI component scanning
export const postcssConfig = {
  plugins: {
    "@tailwindcss/postcss": {
      base: process.cwd() + "/../..", // Points to monorepo root for content scanning
    },
  },
}
