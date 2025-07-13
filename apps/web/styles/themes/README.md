# Theme System

This directory contains the theme system for the Next.js application. The system supports both **single color scheme themes** and **themes with light/dark variants**.

## Theme Types

### 1. Single Color Scheme Themes
These themes use one color scheme regardless of system preference:
- `light.css` - Light colors
- `dark.css` - Dark colors
- `blue.css` - Blue-tinted theme
- `green.css` - Green-tinted theme

### 2. Light/Dark Variant Themes
These themes have separate files for light and dark versions:
- `ocean-light.css` - Ocean theme light variant
- `ocean-dark.css` - Ocean theme dark variant

### 3. Adaptive Themes
These themes automatically switch between light and dark based on system preference:
- `ocean-adaptive.css` - Ocean theme that adapts to system preference

## How to Switch Themes

Edit the `theme-config.css` file and uncomment the desired theme import while commenting out the others:

### For Single Color Schemes:
```css
/* @import "./light.css"; */     /* Light theme */
@import "./dark.css";            /* Dark theme - ACTIVE */
/* @import "./blue.css"; */      /* Blue theme */
```

### For Light/Dark Variants:
```css
/* Choose either light OR dark variant */
@import "./ocean-light.css";     /* Ocean light - ACTIVE */
/* @import "./ocean-dark.css"; */ /* Ocean dark */
```

### For Adaptive Themes:
```css
@import "./ocean-adaptive.css";  /* Ocean adaptive - ACTIVE */
```

**Important**: Only one theme should be imported at a time.

## Creating New Themes

### Single Color Scheme Theme

1. Create a new CSS file (e.g., `purple.css`)
2. Define all color properties in `:root {}`
3. Add the import to `theme-config.css`

```css
/* Purple Theme */
:root {
  --background: oklch(0.95 0.02 300);
  --foreground: oklch(0.15 0.03 300);
  /* ... all other properties ... */
}
```

### Light/Dark Variant Theme

1. Create two files: `mytheme-light.css` and `mytheme-dark.css`
2. Define colors for each variant
3. Add both imports to `theme-config.css` (use only one at a time)

### Adaptive Theme

1. Create one file (e.g., `mytheme-adaptive.css`)
2. Define light colors in `:root {}`
3. Define dark colors in `@media (prefers-color-scheme: dark) { :root {} }`

```css
/* Adaptive Theme */
:root {
  /* Light mode colors */
  --background: oklch(0.98 0.01 280);
  --foreground: oklch(0.15 0.02 280);
  /* ... */
}

@media (prefers-color-scheme: dark) {
  :root {
    /* Dark mode colors */
    --background: oklch(0.12 0.02 280);
    --foreground: oklch(0.9 0.01 280);
    /* ... */
  }
}
```

## Theme Structure

Each theme must define these CSS custom properties:

```css
:root {
  --background: /* Main background color */
  --foreground: /* Main text color */
  --card: /* Card background */
  --card-foreground: /* Card text */
  --popover: /* Popover background */
  --popover-foreground: /* Popover text */
  --primary: /* Primary brand color */
  --primary-foreground: /* Primary text */
  --secondary: /* Secondary color */
  --secondary-foreground: /* Secondary text */
  --muted: /* Muted background */
  --muted-foreground: /* Muted text */
  --accent: /* Accent color */
  --accent-foreground: /* Accent text */
  --destructive: /* Error/danger color */
  --border: /* Border color */
  --input: /* Input background */
  --ring: /* Focus ring color */
  --chart-1: /* Chart color 1 */
  --chart-2: /* Chart color 2 */
  --chart-3: /* Chart color 3 */
  --chart-4: /* Chart color 4 */
  --chart-5: /* Chart color 5 */
  --sidebar: /* Sidebar background */
  --sidebar-foreground: /* Sidebar text */
  --sidebar-primary: /* Sidebar primary */
  --sidebar-primary-foreground: /* Sidebar primary text */
  --sidebar-accent: /* Sidebar accent */
  --sidebar-accent-foreground: /* Sidebar accent text */
  --sidebar-border: /* Sidebar border */
  --sidebar-ring: /* Sidebar focus ring */
}
```

## Color Format

All colors use the OKLCH format for better perceptual uniformity:

```css
--primary: oklch(0.5 0.2 240); /* lightness chroma hue */
```

## Integration with Tailwind

These CSS custom properties are automatically mapped to Tailwind classes through the `@theme inline` directive in `globals.css`. Use standard Tailwind classes like:

- `bg-primary` - Uses `--primary`
- `text-foreground` - Uses `--foreground`
- `border-border` - Uses `--border`

## File Structure

```
styles/themes/
├── README.md              # This file
├── theme-config.css       # Theme switcher configuration
├── light.css             # Single scheme - light
├── dark.css              # Single scheme - dark
├── blue.css              # Single scheme - blue
├── green.css             # Single scheme - green
├── ocean-light.css       # Variant - ocean light
├── ocean-dark.css        # Variant - ocean dark
├── ocean-adaptive.css    # Adaptive - ocean auto
└── [custom].css          # Your custom themes
```

## Examples

### Switching to Blue Theme (Single Scheme):
```css
/* @import "./light.css"; */
@import "./blue.css";  /* Blue theme - ACTIVE */
```

### Switching to Ocean Dark:
```css
/* @import "./light.css"; */
@import "./ocean-dark.css";  /* Ocean dark - ACTIVE */
```

### Using Adaptive Ocean (Auto Light/Dark):
```css
/* @import "./light.css"; */
@import "./ocean-adaptive.css";  /* Ocean adaptive - ACTIVE */
``` 