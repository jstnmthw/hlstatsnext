import { addons } from "storybook/manager-api"
import { themes } from "storybook/theming"

addons.setConfig({
  theme: {
    ...themes.dark,
    brandTitle: "HLStatsNext UI",
    fontBase: '"JetBrains Mono", ui-monospace, monospace',
  },
})
