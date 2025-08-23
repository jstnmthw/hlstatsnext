# @repo/ui

A shared UI component library for HLStatsNext, built with [shadcn/ui](https://ui.shadcn.com/), Tailwind CSS, and TypeScript. This package provides reusable, accessible, and customizable components across all applications in the monorepo.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Component Management](#component-management)
- [Development Workflow](#development-workflow)
- [Usage in Apps](#usage-in-apps)
- [Styling & Theming](#styling--theming)
- [Creating Custom Components](#creating-custom-components)
- [Best Practices](#best-practices)
- [Contributing](#contributing)

## Overview

The `@repo/ui` package serves as the central component library for HLStatsNext, providing:

- **shadcn/ui components**: Pre-built, accessible components
- **Custom components**: HLStatsNext-specific UI elements
- **Shared styling**: Global CSS and Tailwind configuration
- **Type safety**: Full TypeScript support
- **Consistency**: Unified design system across apps

## Tech Stack

- **[shadcn/ui](https://ui.shadcn.com/)**: Component collection built on Radix UI
- **[Radix UI](https://www.radix-ui.com/)**: Low-level UI primitives
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework
- **[TypeScript](https://www.typescriptlang.org/)**: Type safety and better DX
- **[Lucide React](https://lucide.dev/)**: Icon library
- **[class-variance-authority](https://cva.style/)**: Component variants
- **[clsx](https://github.com/lukeed/clsx)** & **[tailwind-merge](https://github.com/dcastil/tailwind-merge)**: Conditional classes

## Getting Started

### Prerequisites

Make sure you're in the monorepo root and have installed dependencies:

```bash
pnpm install
```

### Package Scripts

```bash
# Utilities
pnpm ui add [component]  # Add shadcn/ui components
pnpm lint              # Lint the codebase
pnpm check-types       # Type checking
pnpm clean             # Clean node_modules
```

> **Note**: This package follows TurboRepo's JIT (Just-In-Time) pattern - components are consumed directly as TypeScript source files by consuming applications, eliminating the need for build scripts.

## Project Structure

```
packages/ui/
├── src/
│   ├── components/          # shadcn/ui and custom components
│   │   ├── breadcrumb.tsx   # Example shadcn component
│   │   ├── button.tsx       # Example shadcn component
│   │   └── ...              # Other components
│   ├── lib/
│   │   └── utils.ts         # Utility functions (cn, etc.)
│   ├── index.ts             # Main barrel export
│   ├── icons.ts             # Re-exported lucide-react icons
│   └── globals.css          # Global styles and CSS variables
├── components.json          # shadcn/ui configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Component Management

### Adding shadcn/ui Components

Use the provided script to add pre-built components:

```bash
# Navigate to the ui package
cd packages/ui

# Add components
pnpm ui add button
pnpm ui add input
pnpm ui add card
pnpm ui add dialog

# Add multiple components at once
pnpm ui add button input card dialog
```

### Available shadcn/ui Components

Visit [shadcn/ui components](https://ui.shadcn.com/docs/components) for the full list. Popular components include:

- **Form & Input**: `button`, `input`, `textarea`, `select`, `checkbox`, `radio`
- **Layout**: `card`, `separator`, `sheet`, `dialog`, `popover`
- **Navigation**: `tabs`, `breadcrumb`, `menubar`, `navigation-menu`
- **Feedback**: `alert`, `toast`, `progress`, `skeleton`
- **Data Display**: `table`, `badge`, `avatar`, `calendar`

### Configuration

The `components.json` file configures shadcn/ui behavior:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york", // Component style variant
  "rsc": false, // React Server Components
  "tsx": true, // TypeScript support
  "tailwind": {
    "config": "", // Tailwind config path
    "css": "src/styles.css", // CSS file path
    "baseColor": "zinc", // Base color palette
    "cssVariables": true, // Use CSS variables
    "prefix": "" // Class prefix
  },
  "aliases": {
    // Import path aliases
    "components": "@/components",
    "utils": "@/lib/utils"
  },
  "iconLibrary": "lucide" // Icon library
}
```

## Development Workflow

### 1. Adding a New Component

```bash
# Add the shadcn component
pnpm ui add button

# The component will be created at:
# src/components/button.tsx
```

### 2. Customizing Components

After adding a component, you can customize it:

```typescript
// src/components/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
```

### 3. Exporting Components

Add new components to the main export file:

```typescript
// src/components/index.ts
export { Button } from "./button"
export { Breadcrumb, BreadcrumbList, BreadcrumbItem } from "./breadcrumb"
// ... other exports
```

### 4. Building & Testing

```bash
# Build the package
pnpm build:components
pnpm build:styles

# Type checking
pnpm check-types

# Linting
pnpm lint
```

## Usage in Apps

### Importing Components

In your Next.js apps (`apps/web`) or other packages:

```typescript
// Import components and utilities from main entry point
import { Button, Card, Badge, cn } from '@repo/ui'

// Import styles
import '@repo/ui/globals.css'

// Usage
export default function MyComponent() {
  return (
    <Card>
      <div className={cn("p-4", "space-y-2")}>
        <Badge>New</Badge>
        <Button variant="default" size="lg">
          Submit
        </Button>
      </div>
    </Card>
  )
}
```

### Package Configuration

Make sure your app's `package.json` includes the UI package:

```json
{
  "dependencies": {
    "@repo/ui": "workspace:*"
  }
}
```

### Tailwind Configuration

Your apps should extend the shared Tailwind config:

```javascript
// tailwind.config.js
import { createConfig } from "@repo/tailwind-config"

export default createConfig({
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}", // Include UI package
  ],
})
```

## Styling & Theming

### CSS Variables

The package uses CSS variables for theming, defined in `globals.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    /* ... more variables */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* ... dark theme variables */
  }
}
```

### Custom Utilities

Utility functions in `lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Commonly Added Components

When building HLStatsNext, you'll likely need:

```bash
# Essential form components
pnpm ui add button input textarea select checkbox

# Layout components
pnpm ui add card separator sheet dialog

# Navigation components
pnpm ui add tabs breadcrumb menubar

# Data display
pnpm ui add table badge avatar

# Feedback components
pnpm ui add alert toast progress skeleton
```

## Creating Custom Components

For HLStatsNext-specific components, create them alongside shadcn components:

```typescript
// src/components/player-stats-card.tsx
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Badge } from './badge'

interface PlayerStatsCardProps {
  playerName: string
  kills: number
  deaths: number
  rank: number
}

export function PlayerStatsCard({
  playerName,
  kills,
  deaths,
  rank
}: PlayerStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {playerName}
          <Badge variant="secondary">#{rank}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Kills</p>
            <p className="text-2xl font-bold">{kills}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Deaths</p>
            <p className="text-2xl font-bold">{deaths}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

## Best Practices

### Component Development

1. **Use TypeScript**: Always type your props and components
2. **Forward refs**: Use `React.forwardRef` for components that need ref access
3. **Variant props**: Leverage `class-variance-authority` for component variants
4. **Composition**: Prefer composition over complex prop interfaces
5. **Accessibility**: Ensure components are accessible (shadcn/ui handles most of this)

### Styling

1. **Use the `cn` utility**: Always merge classes with `cn()` function
2. **CSS variables**: Use CSS variables for colors to support theming
3. **Responsive design**: Use Tailwind's responsive modifiers
4. **Consistent spacing**: Use Tailwind's spacing scale consistently

### Performance

1. **Tree shaking**: Export components individually for better tree shaking
2. **Lazy loading**: Use dynamic imports for heavy components
3. **Minimize bundle size**: Only add components you actually use

### Organization

1. **Consistent naming**: Use PascalCase for components, kebab-case for files
2. **Export patterns**: Re-export from index files for clean imports
3. **Documentation**: Add JSDoc comments for complex components
4. **Testing**: Test custom components thoroughly

## Contributing

### Adding Components

1. **Check existing**: Verify the component doesn't already exist
2. **Use shadcn first**: Prefer shadcn/ui components over custom ones
3. **Follow conventions**: Match existing patterns and naming
4. **Update exports**: Add new components to the index file
5. **Document**: Update this README with new components

### Code Style

- Follow the existing TypeScript and React patterns
- Use the project's ESLint configuration
- Write descriptive component and prop names
- Include proper TypeScript types

### Testing Workflow

```bash
# Before submitting changes
pnpm check-types      # Verify TypeScript
pnpm lint             # Check code style
pnpm build:components # Ensure it builds
```

---

For more information about shadcn/ui components, visit the [official documentation](https://ui.shadcn.com/).
