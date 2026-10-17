import { config } from "@repo/eslint-config/react-internal"
import storybook from "eslint-plugin-storybook"

/** @type {import("eslint").Linter.Config[]} */
export default [...config, ...storybook.configs["flat/recommended"]]
