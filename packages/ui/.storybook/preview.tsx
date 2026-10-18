import type { Preview } from "@storybook/react-vite"
import { themes } from "storybook/theming"

import { TooltipProvider } from "../src/components/tooltip"
import "./preview.css"

const preview: Preview = {
  parameters: {
    layout: "centered",
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      theme: themes.dark,
    },
    options: {
      storySort: {
        order: ["Introduction", "Foundations", "Components", "Patterns"],
      },
    },
  },
  decorators: [
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
  ],
}

export default preview
