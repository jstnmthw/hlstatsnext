export interface TableOfContentsItem {
  id: string
  title: string
  subsections: Array<{ id: string; title: string }>
}

export const tableOfContents: TableOfContentsItem[] = [
  {
    id: "typography",
    title: "Typography",
    subsections: [],
  },
  {
    id: "color-palette",
    title: "Color Palette",
    subsections: [],
  },
  {
    id: "buttons",
    title: "Buttons",
    subsections: [
      { id: "button-variants", title: "Button Variants" },
      { id: "button-sizes", title: "Button Sizes" },
      { id: "button-colors-solid", title: "Solid Buttons - Colors" },
      { id: "button-colors-outline", title: "Outline Buttons - Colors" },
      { id: "button-colors-plain", title: "Plain Buttons - Colors" },
      { id: "button-icons", title: "Buttons with Icons" },
    ],
  },
  {
    id: "badges",
    title: "Badges",
    subsections: [
      { id: "badge-variants", title: "Badge Variants" },
      { id: "badge-colors-solid", title: "Solid Badges - Colors" },
      { id: "badge-colors-outline", title: "Outline Badges - Colors" },
      { id: "badge-colors-plain", title: "Plain Badges - Colors" },
      { id: "badge-icons", title: "Badges with Icons" },
      { id: "badge-numbers", title: "Number Badges" },
      { id: "badge-status", title: "Status Badges" },
    ],
  },
  {
    id: "form-elements",
    title: "Form Elements",
    subsections: [
      { id: "input-fields", title: "Input Fields" },
      { id: "textarea", title: "Textarea" },
      { id: "select", title: "Select" },
      { id: "checkboxes", title: "Checkboxes" },
      { id: "radio-buttons", title: "Radio Buttons" },
    ],
  },
  {
    id: "layout-components",
    title: "Layout Components",
    subsections: [
      { id: "cards", title: "Cards" },
      { id: "border-radius", title: "Border Radius" },
    ],
  },
  {
    id: "spacing",
    title: "Spacing",
    subsections: [{ id: "padding-examples", title: "Padding Examples" }],
  },
  {
    id: "interactive-elements",
    title: "Interactive Elements",
    subsections: [
      { id: "links", title: "Links" },
      { id: "code-blocks", title: "Code Blocks" },
    ],
  },
  {
    id: "tables",
    title: "Tables",
    subsections: [],
  },
  {
    id: "lists",
    title: "Lists",
    subsections: [
      { id: "unordered-list", title: "Unordered List" },
      { id: "ordered-list", title: "Ordered List" },
    ],
  },
]
