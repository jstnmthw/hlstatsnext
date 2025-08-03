import { Button } from "@repo/ui/button"
import { BellIcon, BoltIcon, PaperclipIcon } from "lucide-react"

export default function KitchenSinkPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-7xl space-y-12">
        {/* Header */}
        <header className="space-y-4">
          <h1 className="text-5xl font-bold text-foreground">UI Kitchen Sink</h1>
          <p className="text-lg text-muted-foreground">
            A comprehensive showcase of all UI components and design elements
          </p>
        </header>

        {/* Typography Section */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold text-foreground">Typography</h2>
          <div className="space-y-4 rounded-lg border border-border bg-card p-6">
            <h1 className="text-5xl font-bold">Heading 1 - text-5xl</h1>
            <h2 className="text-4xl font-bold">Heading 2 - text-4xl</h2>
            <h3 className="text-3xl font-semibold">Heading 3 - text-3xl</h3>
            <h4 className="text-2xl font-semibold">Heading 4 - text-2xl</h4>
            <h5 className="text-xl font-medium">Heading 5 - text-xl</h5>
            <h6 className="text-lg font-medium">Heading 6 - text-lg</h6>
            <p className="text-base">Regular paragraph text - text-base</p>
            <p className="text-sm text-muted-foreground">Small muted text - text-sm</p>
            <p className="text-xs text-muted-foreground">Extra small text - text-xs</p>
            <p className="font-light">Light font weight</p>
            <p className="font-normal">Normal font weight</p>
            <p className="font-medium">Medium font weight</p>
            <p className="font-semibold">Semibold font weight</p>
            <p className="font-bold">Bold font weight</p>
            <p className="italic">Italic text style</p>
            <p className="underline">Underlined text</p>
            <p className="line-through">Strikethrough text</p>
          </div>
        </section>

        {/* Color Palette Section */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold text-foreground">Color Palette</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {/* Background Colors */}
            <div className="space-y-2">
              <div className="h-20 rounded-md bg-background border border-border flex items-center justify-center">
                <span className="text-sm font-medium">background</span>
              </div>
              <p className="text-xs text-center text-muted-foreground">bg-background</p>
            </div>

            <div className="space-y-2">
              <div className="h-20 rounded-md bg-foreground flex items-center justify-center">
                <span className="text-sm font-medium text-background">foreground</span>
              </div>
              <p className="text-xs text-center text-muted-foreground">bg-foreground</p>
            </div>

            <div className="space-y-2">
              <div className="h-20 rounded-md bg-card border border-border flex items-center justify-center">
                <span className="text-sm font-medium">card</span>
              </div>
              <p className="text-xs text-center text-muted-foreground">bg-card</p>
            </div>

            <div className="space-y-2">
              <div className="h-20 rounded-md bg-primary flex items-center justify-center">
                <span className="text-sm font-medium text-primary-foreground">primary</span>
              </div>
              <p className="text-xs text-center text-muted-foreground">bg-primary</p>
            </div>

            <div className="space-y-2">
              <div className="h-20 rounded-md bg-secondary flex items-center justify-center">
                <span className="text-sm font-medium text-secondary-foreground">secondary</span>
              </div>
              <p className="text-xs text-center text-muted-foreground">bg-secondary</p>
            </div>

            <div className="space-y-2">
              <div className="h-20 rounded-md bg-muted flex items-center justify-center">
                <span className="text-sm font-medium text-muted-foreground">muted</span>
              </div>
              <p className="text-xs text-center text-muted-foreground">bg-muted</p>
            </div>

            <div className="space-y-2">
              <div className="h-20 rounded-md bg-accent flex items-center justify-center">
                <span className="text-sm font-medium text-accent-foreground">accent</span>
              </div>
              <p className="text-xs text-center text-muted-foreground">bg-accent</p>
            </div>

            <div className="space-y-2">
              <div className="h-20 rounded-md bg-destructive flex items-center justify-center">
                <span className="text-sm font-medium text-destructive-foreground">destructive</span>
              </div>
              <p className="text-xs text-center text-muted-foreground">bg-destructive</p>
            </div>
          </div>
        </section>

        {/* Buttons Section */}
        <section className="space-y-6">
          {/* Button Component Section */}
          <div>
            <h2 className="mb-6 text-2xl font-semibold text-gray-800 dark:text-white">Buttons</h2>

            {/* Variants */}
            <div className="mb-8">
              <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
                Button Variants
              </h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="solid">Solid Button</Button>
                <Button variant="outline">Outline Button</Button>
                <Button variant="plain">Plain Button</Button>
              </div>
            </div>

            {/* Sizes */}
            <div className="mb-8">
              <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
                Button Sizes
              </h3>
              <div className="flex flex-wrap items-center gap-4">
                <Button variant="solid" colorScheme="blue" size="xs">
                  Extra Small Button
                </Button>
                <Button variant="solid" colorScheme="blue" size="sm">
                  Small Button
                </Button>
                <Button variant="solid" colorScheme="blue" size="default">
                  Default Button
                </Button>
                <Button variant="solid" colorScheme="blue" size="lg">
                  Large Button
                </Button>
                <Button variant="solid" colorScheme="blue" size="xl">
                  Extra Large Button
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Button variant="solid" colorScheme="blue" size="xs">
                  <BellIcon data-slot="icon" />
                  <span>Extra Small Button</span>
                </Button>
                <Button variant="solid" colorScheme="blue" size="sm">
                  <BellIcon data-slot="icon" />
                  <span>Small Button</span>
                </Button>
                <Button variant="solid" colorScheme="blue" size="default">
                  <BellIcon data-slot="icon" />
                  <span>Default Button</span>
                </Button>
                <Button variant="solid" colorScheme="blue" size="lg">
                  <BellIcon data-slot="icon" />
                  <span>Large Button</span>
                </Button>
                <Button variant="solid" colorScheme="blue" size="xl">
                  <BellIcon data-slot="icon" />
                  <span>Extra Large Button</span>
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Button variant="solid" colorScheme="blue" size="xs">
                  <BellIcon data-slot="icon" />
                </Button>
                <Button variant="solid" colorScheme="blue" size="sm">
                  <BellIcon data-slot="icon" />
                </Button>
                <Button variant="solid" colorScheme="blue" size="default">
                  <BellIcon data-slot="icon" />
                </Button>
                <Button variant="solid" colorScheme="blue" size="lg">
                  <BellIcon data-slot="icon" />
                </Button>
                <Button variant="solid" colorScheme="blue" size="xl">
                  <BellIcon data-slot="icon" />
                </Button>
              </div>

              {/* Colors - Solid */}
              <div className="mb-8">
                <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
                  Solid Buttons - Colors
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="solid" colorScheme="dark">
                    Dark
                  </Button>
                  <Button variant="solid" colorScheme="light">
                    Light
                  </Button>
                  <Button variant="solid" colorScheme="dark/white">
                    Dark/White
                  </Button>
                  <Button variant="solid" colorScheme="zinc">
                    Zinc
                  </Button>
                  <Button variant="solid" colorScheme="red">
                    Red
                  </Button>
                  <Button variant="solid" colorScheme="orange">
                    Orange
                  </Button>
                  <Button variant="solid" colorScheme="amber">
                    Amber
                  </Button>
                  <Button variant="solid" colorScheme="yellow">
                    Yellow
                  </Button>
                  <Button variant="solid" colorScheme="lime">
                    Lime
                  </Button>
                  <Button variant="solid" colorScheme="green">
                    Green
                  </Button>
                  <Button variant="solid" colorScheme="emerald">
                    Emerald
                  </Button>
                  <Button variant="solid" colorScheme="teal">
                    Teal
                  </Button>
                  <Button variant="solid" colorScheme="cyan">
                    Cyan
                  </Button>
                  <Button variant="solid" colorScheme="sky">
                    Sky
                  </Button>
                  <Button variant="solid" colorScheme="blue">
                    Blue
                  </Button>
                  <Button variant="solid" colorScheme="indigo">
                    Indigo
                  </Button>
                  <Button variant="solid" colorScheme="violet">
                    Violet
                  </Button>
                  <Button variant="solid" colorScheme="purple">
                    Purple
                  </Button>
                  <Button variant="solid" colorScheme="fuchsia">
                    Fuchsia
                  </Button>
                  <Button variant="solid" colorScheme="pink">
                    Pink
                  </Button>
                  <Button variant="solid" colorScheme="rose">
                    Rose
                  </Button>
                </div>
              </div>

              {/* Colors - Outline */}
              <div className="mb-8">
                <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
                  Outline Buttons - Colors
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="outline" colorScheme="dark">
                    Dark
                  </Button>
                  <Button variant="outline" colorScheme="light">
                    Light
                  </Button>
                  <Button variant="outline" colorScheme="dark/white">
                    Dark/White
                  </Button>
                  <Button variant="outline" colorScheme="zinc">
                    Zinc
                  </Button>
                  <Button variant="outline" colorScheme="red">
                    Red
                  </Button>
                  <Button variant="outline" colorScheme="orange">
                    Orange
                  </Button>
                  <Button variant="outline" colorScheme="amber">
                    Amber
                  </Button>
                  <Button variant="outline" colorScheme="yellow">
                    Yellow
                  </Button>
                  <Button variant="outline" colorScheme="lime">
                    Lime
                  </Button>
                  <Button variant="outline" colorScheme="green">
                    Green
                  </Button>
                  <Button variant="outline" colorScheme="emerald">
                    Emerald
                  </Button>
                  <Button variant="outline" colorScheme="teal">
                    Teal
                  </Button>
                  <Button variant="outline" colorScheme="cyan">
                    Cyan
                  </Button>
                  <Button variant="outline" colorScheme="sky">
                    Sky
                  </Button>
                  <Button variant="outline" colorScheme="blue">
                    Blue
                  </Button>
                  <Button variant="outline" colorScheme="indigo">
                    Indigo
                  </Button>
                  <Button variant="outline" colorScheme="violet">
                    Violet
                  </Button>
                  <Button variant="outline" colorScheme="purple">
                    Purple
                  </Button>
                  <Button variant="outline" colorScheme="fuchsia">
                    Fuchsia
                  </Button>
                  <Button variant="outline" colorScheme="pink">
                    Pink
                  </Button>
                  <Button variant="outline" colorScheme="rose">
                    Rose
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Button variant="outline" colorScheme="indigo" size="xs">
                    <BellIcon data-slot="icon" />
                    <span>Extra Small Button</span>
                  </Button>
                  <Button variant="outline" colorScheme="indigo" size="sm">
                    <BellIcon data-slot="icon" />
                    <span>Small Button</span>
                  </Button>
                  <Button variant="outline" colorScheme="indigo" size="default">
                    <BellIcon data-slot="icon" />
                    <span>Default Button</span>
                  </Button>
                  <Button variant="outline" colorScheme="indigo" size="lg">
                    <BellIcon data-slot="icon" />
                    <span>Large Button</span>
                  </Button>
                  <Button variant="outline" colorScheme="indigo" size="xl">
                    <BellIcon data-slot="icon" />
                    <span>Extra Large Button</span>
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Button variant="outline" colorScheme="blue" size="icon-xs">
                    <BellIcon data-slot="icon" />
                  </Button>
                  <Button variant="outline" colorScheme="indigo" size="icon-sm">
                    <BellIcon data-slot="icon" />
                  </Button>
                  <Button variant="outline" colorScheme="purple" size="icon">
                    <BellIcon data-slot="icon" />
                  </Button>
                  <Button variant="outline" colorScheme="fuchsia" size="icon-lg">
                    <BellIcon data-slot="icon" />
                  </Button>
                  <Button variant="outline" colorScheme="pink" size="icon-xl">
                    <BellIcon data-slot="icon" />
                  </Button>
                </div>
              </div>

              {/* Colors - Plain */}
              <div className="mb-8">
                <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
                  Plain Buttons - Colors
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="plain" colorScheme="dark">
                    Dark
                  </Button>
                  <Button variant="plain" colorScheme="light">
                    Light
                  </Button>
                  <Button variant="plain" colorScheme="dark/white">
                    Dark/White
                  </Button>
                  <Button variant="plain" colorScheme="zinc">
                    Zinc
                  </Button>
                  <Button variant="plain" colorScheme="red">
                    Red
                  </Button>
                  <Button variant="plain" colorScheme="orange">
                    Orange
                  </Button>
                  <Button variant="plain" colorScheme="amber">
                    Amber
                  </Button>
                  <Button variant="plain" colorScheme="yellow">
                    Yellow
                  </Button>
                  <Button variant="plain" colorScheme="lime">
                    Lime
                  </Button>
                  <Button variant="plain" colorScheme="green">
                    Green
                  </Button>
                  <Button variant="plain" colorScheme="emerald">
                    Emerald
                  </Button>
                  <Button variant="plain" colorScheme="teal">
                    Teal
                  </Button>
                  <Button variant="plain" colorScheme="cyan">
                    Cyan
                  </Button>
                  <Button variant="plain" colorScheme="sky">
                    Sky
                  </Button>
                  <Button variant="plain" colorScheme="blue">
                    Blue
                  </Button>
                  <Button variant="plain" colorScheme="indigo">
                    Indigo
                  </Button>
                  <Button variant="plain" colorScheme="violet">
                    Violet
                  </Button>
                  <Button variant="plain" colorScheme="purple">
                    Purple
                  </Button>
                  <Button variant="plain" colorScheme="fuchsia">
                    Fuchsia
                  </Button>
                  <Button variant="plain" colorScheme="pink">
                    Pink
                  </Button>
                  <Button variant="plain" colorScheme="rose">
                    Rose
                  </Button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <Button variant="plain" colorScheme="blue" size="icon-xs">
                    <BellIcon data-slot="icon" />
                  </Button>
                  <Button variant="plain" colorScheme="indigo" size="icon-sm">
                    <BellIcon data-slot="icon" />
                  </Button>
                  <Button variant="plain" colorScheme="purple" size="icon">
                    <BellIcon data-slot="icon" />
                  </Button>
                  <Button variant="plain" colorScheme="fuchsia" size="icon-lg">
                    <BellIcon data-slot="icon" />
                  </Button>
                  <Button variant="plain" colorScheme="pink" size="icon-xl">
                    <BellIcon data-slot="icon" />
                  </Button>
                </div>
              </div>

              {/* With Icons */}
              <div>
                <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
                  Buttons with Icons
                </h3>
                <div className="flex flex-wrap items-center gap-4">
                  <Button variant="solid" colorScheme="blue">
                    <BellIcon data-slot="icon" />
                    Button with Icon
                  </Button>
                  <Button variant="outline" colorScheme="blue">
                    <PaperclipIcon data-slot="icon" />
                    Button with Icon
                  </Button>
                  <Button variant="plain" colorScheme="blue">
                    <BoltIcon data-slot="icon" />
                    Button with Icon
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Form Elements Section */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold text-foreground">Form Elements</h2>
          <div className="space-y-6 rounded-lg border border-border bg-card p-6">
            {/* Text Inputs */}
            <div className="space-y-4">
              <h3 className="text-xl font-medium">Input Fields</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="text-input" className="text-sm font-medium">
                    Text Input
                  </label>
                  <input
                    id="text-input"
                    type="text"
                    placeholder="Enter text..."
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="email-input" className="text-sm font-medium">
                    Email Input
                  </label>
                  <input
                    id="email-input"
                    type="email"
                    placeholder="email@example.com"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password-input" className="text-sm font-medium">
                    Password Input
                  </label>
                  <input
                    id="password-input"
                    type="password"
                    placeholder="••••••••"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="disabled-input" className="text-sm font-medium">
                    Disabled Input
                  </label>
                  <input
                    id="disabled-input"
                    type="text"
                    placeholder="Disabled"
                    disabled
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Textarea */}
            <div className="space-y-2">
              <label htmlFor="textarea" className="text-sm font-medium">
                Textarea
              </label>
              <textarea
                id="textarea"
                placeholder="Enter your message..."
                rows={4}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Select */}
            <div className="space-y-2">
              <label htmlFor="select" className="text-sm font-medium">
                Select
              </label>
              <select
                id="select"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Choose an option...</option>
                <option value="option1">Option 1</option>
                <option value="option2">Option 2</option>
                <option value="option3">Option 3</option>
              </select>
            </div>

            {/* Checkboxes and Radio */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Checkboxes</h4>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="h-4 w-4 rounded border-input" />
                    <span className="text-sm">Option 1</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      defaultChecked
                    />
                    <span className="text-sm">Option 2 (checked)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="h-4 w-4 rounded border-input" disabled />
                    <span className="text-sm">Option 3 (disabled)</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Radio Buttons</h4>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2">
                    <input type="radio" name="radio-group" className="h-4 w-4 border-input" />
                    <span className="text-sm">Option A</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="radio-group"
                      className="h-4 w-4 border-input"
                      defaultChecked
                    />
                    <span className="text-sm">Option B (selected)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="radio-group"
                      className="h-4 w-4 border-input"
                      disabled
                    />
                    <span className="text-sm">Option C (disabled)</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Layout Components */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold text-foreground">Layout Components</h2>

          {/* Cards */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Cards</h3>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h4 className="mb-2 text-lg font-semibold">Card Title</h4>
                <p className="text-sm text-muted-foreground">
                  This is a basic card component with border and shadow.
                </p>
              </div>

              <div className="rounded-lg bg-secondary p-6">
                <h4 className="mb-2 text-lg font-semibold text-secondary-foreground">
                  Secondary Card
                </h4>
                <p className="text-sm text-secondary-foreground">
                  This card uses the secondary background color.
                </p>
              </div>

              <div className="rounded-lg bg-muted p-6">
                <h4 className="mb-2 text-lg font-semibold text-muted-foreground">Muted Card</h4>
                <p className="text-sm text-muted-foreground">
                  This card uses the muted background color.
                </p>
              </div>
            </div>
          </div>

          {/* Borders and Radius */}
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Border Radius</h3>
            <div className="flex flex-wrap gap-4">
              <div className="h-20 w-20 rounded-sm bg-primary" title="rounded-sm" />
              <div className="h-20 w-20 rounded-md bg-primary" title="rounded-md" />
              <div className="h-20 w-20 rounded-lg bg-primary" title="rounded-lg" />
              <div className="h-20 w-20 rounded-xl bg-primary" title="rounded-xl" />
              <div className="h-20 w-20 rounded-full bg-primary" title="rounded-full" />
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold text-foreground">Spacing</h2>
          <div className="space-y-4">
            <h3 className="text-xl font-medium">Padding Examples</h3>
            <div className="space-y-2">
              <div className="bg-muted p-1 text-sm">p-1 (0.25rem)</div>
              <div className="bg-muted p-2 text-sm">p-2 (0.5rem)</div>
              <div className="bg-muted p-4 text-sm">p-4 (1rem)</div>
              <div className="bg-muted p-6 text-sm">p-6 (1.5rem)</div>
              <div className="bg-muted p-8 text-sm">p-8 (2rem)</div>
            </div>
          </div>
        </section>

        {/* Interactive Elements */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold text-foreground">Interactive Elements</h2>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="mb-4 text-xl font-medium">Links</h3>
              <div className="space-x-4">
                <a href="#" className="text-primary hover:underline">
                  Primary Link
                </a>
                <a href="#" className="text-muted-foreground hover:text-foreground hover:underline">
                  Muted Link
                </a>
                <a href="#" className="text-destructive hover:underline">
                  Destructive Link
                </a>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-6">
              <h3 className="mb-4 text-xl font-medium">Code Blocks</h3>
              <pre className="rounded-md bg-muted p-4 text-sm">
                <code>{`const example = {
  theme: "dark",
  variant: "default",
  size: "medium"
};`}</code>
              </pre>
            </div>
          </div>
        </section>

        {/* Tables */}
        <section className="space-y-6">
          <h2 className="text-3xl font-semibold text-foreground">Tables</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="px-4 py-3 text-sm">John Doe</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                      Active
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">Admin</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="px-4 py-3 text-sm">Jane Smith</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-flex rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                      Inactive
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">User</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="outline">
                      Edit
                    </Button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Lists */}
        <section className="space-y-6 pb-12">
          <h2 className="text-3xl font-semibold text-foreground">Lists</h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="text-xl font-medium">Unordered List</h3>
              <ul className="list-disc space-y-2 pl-6 text-sm">
                <li>First item in the list</li>
                <li>Second item with more text</li>
                <li>Third item</li>
                <li>
                  Fourth item with <span className="font-semibold">emphasis</span>
                </li>
              </ul>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-medium">Ordered List</h3>
              <ol className="list-decimal space-y-2 pl-6 text-sm">
                <li>First step in the process</li>
                <li>Second step with details</li>
                <li>Third step</li>
                <li>Final step to complete</li>
              </ol>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
