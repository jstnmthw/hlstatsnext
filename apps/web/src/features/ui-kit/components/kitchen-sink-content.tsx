import {
  Button,
  Badge,
  cn,
  Input,
  Textarea,
  Checkbox,
  RadioGroup,
  RadioGroupItem,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  IPAddress,
  Port,
} from "@repo/ui"

import {
  BellIcon,
  PaperclipIcon,
  CheckIcon,
  XIcon,
  StarIcon,
  AlertTriangleIcon,
  InfoIcon,
  CrownIcon,
  FlameIcon,
  HeartIcon,
  ZapIcon,
} from "lucide-react"

export function KitchenSinkContent({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-12", className)}>
      {/* Header */}
      <header className="space-y-4">
        <h1 className="text-5xl font-bold text-foreground">HlStatsNext - UI Kit</h1>
        <p className="text-lg text-muted-foreground">
          A comprehensive showcase of all UI components and design elements.
        </p>
      </header>

      {/* Typography Section */}
      <section id="typography" className="space-y-6">
        <h2 className="text-3xl font-semibold text-foreground border-b border-border pb-4">
          Typography
        </h2>
        <div className="space-y-4">
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
      <section id="color-palette" className="space-y-6">
        <h2 className="text-3xl font-semibold text-foreground border-b border-border pb-4">
          Color Palette
        </h2>
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
      <section id="buttons" className="space-y-6">
        <div>
          <h2 className="mb-6 text-2xl font-semibold text-foreground border-b border-border pb-4">
            Buttons
          </h2>

          {/* Variants */}
          <div id="button-variants" className="mb-8">
            <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
              Button Variants
            </h3>
            <div className="flex flex-wrap gap-4">
              <Button variant="solid">Solid Button</Button>
              <Button variant="outline">Outline Button</Button>
              <Button variant="ghost">Ghost Button</Button>
            </div>
          </div>

          {/* Sizes */}
          <div id="button-sizes" className="mb-8">
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
            <div id="button-colors-solid" className="mb-8 mt-8">
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
            <div id="button-colors-outline" className="mb-8">
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
                <Button variant="outline" colorScheme="indigo">
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

            {/* Colors - Ghost */}
            <div id="button-colors-ghost" className="mb-8">
              <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
                Ghost Buttons - Colors
              </h3>
              <div className="flex flex-wrap gap-4">
                <Button variant="ghost" colorScheme="dark">
                  Dark
                </Button>
                <Button variant="ghost" colorScheme="light">
                  Light
                </Button>
                <Button variant="ghost" colorScheme="dark/white">
                  Dark/White
                </Button>
                <Button variant="ghost" colorScheme="zinc">
                  Zinc
                </Button>
                <Button variant="ghost" colorScheme="red">
                  Red
                </Button>
                <Button variant="ghost" colorScheme="orange">
                  Orange
                </Button>
                <Button variant="ghost" colorScheme="amber">
                  Amber
                </Button>
                <Button variant="ghost" colorScheme="yellow">
                  Yellow
                </Button>
                <Button variant="ghost" colorScheme="lime">
                  Lime
                </Button>
                <Button variant="ghost" colorScheme="green">
                  Green
                </Button>
                <Button variant="ghost" colorScheme="emerald">
                  Emerald
                </Button>
                <Button variant="ghost" colorScheme="teal">
                  Teal
                </Button>
                <Button variant="ghost" colorScheme="cyan">
                  Cyan
                </Button>
                <Button variant="ghost" colorScheme="sky">
                  Sky
                </Button>
                <Button variant="ghost" colorScheme="blue">
                  Blue
                </Button>
                <Button variant="ghost" colorScheme="indigo">
                  Indigo
                </Button>
                <Button variant="ghost" colorScheme="violet">
                  Violet
                </Button>
                <Button variant="ghost" colorScheme="purple">
                  Purple
                </Button>
                <Button variant="ghost" colorScheme="fuchsia">
                  Fuchsia
                </Button>
                <Button variant="ghost" colorScheme="pink">
                  Pink
                </Button>
                <Button variant="ghost" colorScheme="rose">
                  Rose
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Button variant="ghost" colorScheme="purple" size="xs">
                  <BellIcon data-slot="icon" />
                  <span>Extra Small Button</span>
                </Button>
                <Button variant="ghost" colorScheme="purple" size="sm">
                  <BellIcon data-slot="icon" />
                  <span>Small Button</span>
                </Button>
                <Button variant="ghost" colorScheme="purple">
                  <BellIcon data-slot="icon" />
                  <span>Default Button</span>
                </Button>
                <Button variant="ghost" colorScheme="purple" size="lg">
                  <BellIcon data-slot="icon" />
                  <span>Large Button</span>
                </Button>
                <Button variant="ghost" colorScheme="purple" size="xl">
                  <BellIcon data-slot="icon" />
                  <span>Extra Large Button</span>
                </Button>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Button variant="ghost" colorScheme="blue" size="icon-xs">
                  <BellIcon data-slot="icon" />
                </Button>
                <Button variant="ghost" colorScheme="indigo" size="icon-sm">
                  <BellIcon data-slot="icon" />
                </Button>
                <Button variant="ghost" colorScheme="purple" size="icon">
                  <BellIcon data-slot="icon" />
                </Button>
                <Button variant="ghost" colorScheme="fuchsia" size="icon-lg">
                  <BellIcon data-slot="icon" />
                </Button>
                <Button variant="ghost" colorScheme="pink" size="icon-xl">
                  <BellIcon data-slot="icon" />
                </Button>
              </div>
            </div>

            {/* With Icons */}
            <div id="button-icons">
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
                <Button variant="ghost" colorScheme="blue">
                  <StarIcon data-slot="icon" />
                  Button with Icon
                </Button>
                <Button variant="ghost" colorScheme="purple">
                  <BellIcon data-slot="icon" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Badges Section */}
      <section id="badges" className="space-y-6">
        <div>
          <h2 className="mb-6 text-2xl font-semibold text-foreground border-b border-border pb-4">
            Badges
          </h2>

          {/* Basic Variants */}
          <div id="badge-variants" className="mb-8">
            <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
              Badge Variants
            </h3>
            <div className="flex flex-wrap items-center gap-4">
              <Badge variant="solid">Solid Badge</Badge>
              <Badge variant="outline">Outline Badge</Badge>
              <Badge variant="ghost">Ghost Badge</Badge>
            </div>
          </div>

          {/* Colors - Solid */}
          <div id="badge-colors-solid" className="mb-8">
            <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
              Solid Badges - Colors
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="solid" colorScheme="dark">
                Dark
              </Badge>
              <Badge variant="solid" colorScheme="light">
                Light
              </Badge>
              <Badge variant="solid" colorScheme="dark/white">
                Dark/White
              </Badge>
              <Badge variant="solid" colorScheme="zinc">
                Zinc
              </Badge>
              <Badge variant="solid" colorScheme="red">
                Red
              </Badge>
              <Badge variant="solid" colorScheme="orange">
                Orange
              </Badge>
              <Badge variant="solid" colorScheme="amber">
                Amber
              </Badge>
              <Badge variant="solid" colorScheme="yellow">
                Yellow
              </Badge>
              <Badge variant="solid" colorScheme="lime">
                Lime
              </Badge>
              <Badge variant="solid" colorScheme="green">
                Green
              </Badge>
              <Badge variant="solid" colorScheme="emerald">
                Emerald
              </Badge>
              <Badge variant="solid" colorScheme="teal">
                Teal
              </Badge>
              <Badge variant="solid" colorScheme="cyan">
                Cyan
              </Badge>
              <Badge variant="solid" colorScheme="sky">
                Sky
              </Badge>
              <Badge variant="solid" colorScheme="blue">
                Blue
              </Badge>
              <Badge variant="solid" colorScheme="indigo">
                Indigo
              </Badge>
              <Badge variant="solid" colorScheme="violet">
                Violet
              </Badge>
              <Badge variant="solid" colorScheme="purple">
                Purple
              </Badge>
              <Badge variant="solid" colorScheme="fuchsia">
                Fuchsia
              </Badge>
              <Badge variant="solid" colorScheme="pink">
                Pink
              </Badge>
              <Badge variant="solid" colorScheme="rose">
                Rose
              </Badge>
            </div>
          </div>

          {/* Colors - Outline */}
          <div id="badge-colors-outline" className="mb-8">
            <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
              Outline Badges - Colors
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" colorScheme="dark">
                Dark
              </Badge>
              <Badge variant="outline" colorScheme="light">
                Light
              </Badge>
              <Badge variant="outline" colorScheme="dark/white">
                Dark/White
              </Badge>
              <Badge variant="outline" colorScheme="zinc">
                Zinc
              </Badge>
              <Badge variant="outline" colorScheme="red">
                Red
              </Badge>
              <Badge variant="outline" colorScheme="orange">
                Orange
              </Badge>
              <Badge variant="outline" colorScheme="amber">
                Amber
              </Badge>
              <Badge variant="outline" colorScheme="yellow">
                Yellow
              </Badge>
              <Badge variant="outline" colorScheme="lime">
                Lime
              </Badge>
              <Badge variant="outline" colorScheme="green">
                Green
              </Badge>
              <Badge variant="outline" colorScheme="emerald">
                Emerald
              </Badge>
              <Badge variant="outline" colorScheme="teal">
                Teal
              </Badge>
              <Badge variant="outline" colorScheme="cyan">
                Cyan
              </Badge>
              <Badge variant="outline" colorScheme="sky">
                Sky
              </Badge>
              <Badge variant="outline" colorScheme="blue">
                Blue
              </Badge>
              <Badge variant="outline" colorScheme="indigo">
                Indigo
              </Badge>
              <Badge variant="outline" colorScheme="violet">
                Violet
              </Badge>
              <Badge variant="outline" colorScheme="purple">
                Purple
              </Badge>
              <Badge variant="outline" colorScheme="fuchsia">
                Fuchsia
              </Badge>
              <Badge variant="outline" colorScheme="pink">
                Pink
              </Badge>
              <Badge variant="outline" colorScheme="rose">
                Rose
              </Badge>
            </div>
          </div>

          {/* With Icons */}
          <div id="badge-icons" className="mb-8">
            <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
              Badges with Icons
            </h3>
            <div className="space-y-4">
              {/* Icons Only */}
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  Icon Only
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="solid" colorScheme="blue">
                    <BellIcon />
                  </Badge>
                  <Badge variant="solid" colorScheme="green">
                    <CheckIcon />
                  </Badge>
                  <Badge variant="solid" colorScheme="red">
                    <XIcon />
                  </Badge>
                  <Badge variant="solid" colorScheme="amber">
                    <AlertTriangleIcon />
                  </Badge>
                  <Badge variant="solid" colorScheme="purple">
                    <StarIcon />
                  </Badge>
                  <Badge variant="solid" colorScheme="indigo">
                    <InfoIcon />
                  </Badge>
                </div>
              </div>

              {/* Icon + Text */}
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  Icon + Text
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="solid" colorScheme="green">
                    <CheckIcon />
                    Verified
                  </Badge>
                  <Badge variant="solid" colorScheme="blue">
                    <BellIcon />
                    Notifications
                  </Badge>
                  <Badge variant="solid" colorScheme="purple">
                    <CrownIcon />
                    Premium
                  </Badge>
                  <Badge variant="solid" colorScheme="orange">
                    <FlameIcon />
                    Hot
                  </Badge>
                  <Badge variant="solid" colorScheme="pink">
                    <HeartIcon />
                    Favorite
                  </Badge>
                  <Badge variant="solid" colorScheme="yellow">
                    <ZapIcon />
                    Fast
                  </Badge>
                </div>
              </div>

              {/* Outline Variants with Icons */}
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  Outline + Icons
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" colorScheme="green">
                    <CheckIcon />
                    Success
                  </Badge>
                  <Badge variant="outline" colorScheme="red">
                    <XIcon />
                    Error
                  </Badge>
                  <Badge variant="outline" colorScheme="amber">
                    <AlertTriangleIcon />
                    Warning
                  </Badge>
                  <Badge variant="outline" colorScheme="blue">
                    <InfoIcon />
                    Info
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Number Badges */}
          <div id="badge-numbers" className="mb-8">
            <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
              Number Badges
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  Notification Counts
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="solid" colorScheme="red">
                    1
                  </Badge>
                  <Badge variant="solid" colorScheme="red">
                    3
                  </Badge>
                  <Badge variant="solid" colorScheme="red">
                    12
                  </Badge>
                  <Badge variant="solid" colorScheme="red">
                    99+
                  </Badge>
                  <Badge variant="solid" colorScheme="blue">
                    42
                  </Badge>
                  <Badge variant="solid" colorScheme="green">
                    100
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  Versions & Numbers
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" colorScheme="zinc">
                    v1.0.0
                  </Badge>
                  <Badge variant="outline" colorScheme="zinc">
                    v2.1.5
                  </Badge>
                  <Badge variant="outline" colorScheme="blue">
                    Beta
                  </Badge>
                  <Badge variant="outline" colorScheme="green">
                    Stable
                  </Badge>
                  <Badge variant="outline" colorScheme="amber">
                    RC1
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Status Badges */}
          <div id="badge-status" className="mb-8">
            <h3 className="mb-4 text-lg font-medium text-gray-700 dark:text-gray-200">
              Status Badges
            </h3>
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  User Status
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="solid" colorScheme="green">
                    <span className="w-1.5 h-1.5 bg-white rounded-full mr-1"></span>
                    Online
                  </Badge>
                  <Badge variant="solid" colorScheme="amber">
                    <span className="w-1.5 h-1.5 bg-white rounded-full mr-1"></span>
                    Away
                  </Badge>
                  <Badge variant="solid" colorScheme="red">
                    <span className="w-1.5 h-1.5 bg-white rounded-full mr-1"></span>
                    Busy
                  </Badge>
                  <Badge variant="solid" colorScheme="zinc">
                    <span className="w-1.5 h-1.5 bg-white rounded-full mr-1"></span>
                    Offline
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  System Status
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" colorScheme="green">
                    <CheckIcon />
                    Operational
                  </Badge>
                  <Badge variant="outline" colorScheme="amber">
                    <AlertTriangleIcon />
                    Degraded
                  </Badge>
                  <Badge variant="outline" colorScheme="red">
                    <XIcon />
                    Down
                  </Badge>
                  <Badge variant="outline" colorScheme="blue">
                    <InfoIcon />
                    Maintenance
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  Priority Levels
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="solid" colorScheme="red">
                    Critical
                  </Badge>
                  <Badge variant="solid" colorScheme="orange">
                    High
                  </Badge>
                  <Badge variant="solid" colorScheme="amber">
                    Medium
                  </Badge>
                  <Badge variant="solid" colorScheme="blue">
                    Low
                  </Badge>
                  <Badge variant="solid" colorScheme="zinc">
                    None
                  </Badge>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-300">
                  As Links (hover to see effect)
                </h4>
                <div className="flex flex-wrap items-center gap-3">
                  <Badge asChild variant="solid" colorScheme="blue">
                    <a href="#" className="cursor-pointer">
                      Clickable Badge
                    </a>
                  </Badge>
                  <Badge asChild variant="outline" colorScheme="purple">
                    <a href="#" className="cursor-pointer">
                      <StarIcon />
                      Featured
                    </a>
                  </Badge>
                  <Badge asChild variant="ghost" colorScheme="green">
                    <a href="#" className="cursor-pointer">
                      View Details
                    </a>
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form Elements Section */}
      <section id="form-elements" className="space-y-6">
        <h2 className="text-3xl font-semibold text-foreground border-b border-border pb-4">
          Form Elements
        </h2>
        <div className="space-y-6 rounded-lg border border-border p-6">
          {/* Text Inputs */}
          <div id="input-fields" className="space-y-4">
            <h3 className="text-xl font-medium">Input Fields</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 flex flex-col">
                <label htmlFor="text-input" className="text-sm font-medium">
                  Text Input
                </label>
                <Input id="text-input" type="text" placeholder="Enter text..." />
              </div>

              <div className="space-y-1 flex flex-col">
                <label htmlFor="email-input" className="text-sm font-medium">
                  Email Input
                </label>
                <Input id="email-input" type="email" placeholder="email@example.com" />
              </div>

              <div className="space-y-1 flex flex-col">
                <label htmlFor="password-input" className="text-sm font-medium">
                  Password Input
                </label>
                <Input id="password-input" type="password" placeholder="••••••••" />
              </div>

              <div className="space-y-1 flex flex-col">
                <label htmlFor="disabled-input" className="text-sm font-medium">
                  Disabled Input
                </label>
                <Input id="disabled-input" type="text" placeholder="Disabled" disabled />
              </div>

              <div className="space-y-1 flex flex-col">
                <label htmlFor="ip-address" className="text-sm font-medium">
                  IP Address & Port
                </label>
                <div className="flex">
                  <IPAddress
                    placeholder="192.168.1.1"
                    className="rounded-r-none border-r-0 flex-1"
                  />
                  <Port placeholder="27015" className="rounded-l-none w-18" />
                </div>
              </div>
            </div>
          </div>

          {/* Textarea */}
          <div id="textarea" className="space-y-1 flex flex-col">
            <label htmlFor="textarea-field" className="text-sm font-medium">
              Textarea
            </label>
            <Textarea id="textarea-field" placeholder="Enter your message..." rows={4} />
          </div>

          {/* Select */}
          <div id="select" className="space-y-4 flex flex-col">
            <div>
              Client Side Select
              <label htmlFor="select-field" className="text-sm font-medium">
                Select
              </label>
              <Select>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select a game" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Games</SelectLabel>
                    <SelectItem value="cstrike">Counter-Strike 1.6</SelectItem>
                    <SelectItem value="tfc">Team Fortress Classic</SelectItem>
                    <SelectItem value="dod">Day of Defeat</SelectItem>
                    <SelectItem value="opfor">Opposing Force</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1 flex flex-col">
              Server Side Select
              <select
                id="select-field"
                className="w-[180px] rounded-md border text-base border-input font-sans bg-background px-3 py-2 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="cstrike">Counter-Strike 1.6</option>
                <option value="tfc">Team Fortress Classic</option>
                <option value="dod">Day of Defeat</option>
                <option value="opfor">Opposing Force</option>
              </select>
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex flex-col gap-6" id="checkboxes">
            <h3 className="text-xl font-medium">Checkboxes</h3>
            <div className="flex items-center gap-3">
              <Checkbox id="terms" />
              <Label htmlFor="terms">Accept terms and conditions</Label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="terms-2" defaultChecked />
              <div className="grid gap-2">
                <Label htmlFor="terms-2">Accept terms and conditions</Label>
                <p className="text-muted-foreground text-sm">
                  By clicking this checkbox, you agree to the terms and conditions.
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <Checkbox id="toggle" disabled />
              <Label htmlFor="toggle">Enable notifications</Label>
            </div>
            <Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-primary has-[[aria-checked=true]]:bg-primary/10 dark:has-[[aria-checked=true]]:border-primary dark:has-[[aria-checked=true]]:bg-primary/10">
              <Checkbox id="toggle-2" defaultChecked />
              <div className="grid gap-1.5 font-normal">
                <p className="text-sm leading-none font-medium">Enable notifications</p>
                <p className="text-muted-foreground text-sm">
                  You can enable or disable notifications at any time.
                </p>
              </div>
            </Label>
          </div>

          {/* Radios */}
          <div className="flex flex-col gap-6" id="radios">
            <h3 className="text-xl font-medium">Radios</h3>
            <RadioGroup defaultValue="comfortable">
              <div className="flex items-center gap-3">
                <RadioGroupItem value="default" id="r1" />
                <Label htmlFor="r1">Default</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="comfortable" id="r2" />
                <Label htmlFor="r2">Comfortable</Label>
              </div>
              <div className="flex items-center gap-3">
                <RadioGroupItem value="compact" id="r3" />
                <Label htmlFor="r3">Compact</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </section>

      {/* Layout Components */}
      <section id="layout-components" className="space-y-6">
        <h2 className="text-3xl font-semibold text-foreground border-b border-border pb-4">
          Layout Components
        </h2>

        {/* Cards */}
        <div id="cards" className="space-y-4">
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
        <div id="border-radius" className="space-y-4">
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
      <section id="spacing" className="space-y-6">
        <h2 className="text-3xl font-semibold text-foreground border-b border-border pb-4">
          Spacing
        </h2>
        <div id="padding-examples" className="space-y-4">
          <h3 className="text-xl font-medium">Padding Examples</h3>
          <div className="space-y-2">
            <div className="bg-muted p-1 text-sm rounded-md">p-1 (0.25rem)</div>
            <div className="bg-muted p-2 text-sm rounded-md">p-2 (0.5rem)</div>
            <div className="bg-muted p-4 text-sm rounded-md">p-4 (1rem)</div>
            <div className="bg-muted p-6 text-sm rounded-md">p-6 (1.5rem)</div>
            <div className="bg-muted p-8 text-sm rounded-md">p-8 (2rem)</div>
          </div>
        </div>
      </section>

      {/* Interactive Elements */}
      <section id="interactive-elements" className="space-y-6">
        <h2 className="text-3xl font-semibold text-foreground border-b border-border pb-4">
          Interactive Elements
        </h2>
        <div className="space-y-4">
          <div id="links">
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
          <div id="code-blocks">
            <h3 className="mb-4 text-xl font-medium">Code Blocks</h3>
            <pre className="rounded-md bg-muted p-4 text-sm border border-border">
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
      <section id="tables" className="space-y-6">
        <h2 className="text-3xl font-semibold text-foreground">Tables</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Role</th>
                <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
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
              <tr className="border-b border-border">
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
      <section id="lists" className="space-y-6 pb-12">
        <h2 className="text-3xl font-semibold text-foreground border-b border-border pb-4">
          Lists
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div id="unordered-list" className="space-y-4">
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

          <div id="ordered-list" className="space-y-4">
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
  )
}
