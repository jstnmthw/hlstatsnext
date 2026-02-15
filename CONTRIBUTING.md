# Contributing to HLStatsNext

Thanks for your interest in contributing! This guide covers the process and conventions for submitting changes.

## Getting Started

1. Set up your local development environment — see [DEVELOPMENT.md](./DEVELOPMENT.md)
2. Read through this guide before opening a pull request

## Workflow

1. **Fork** the repository
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/my-feature
   ```
3. **Make your changes** — keep commits focused and well-described
4. **Verify your changes** pass all checks:
   ```bash
   pnpm lint
   pnpm check-types
   pnpm test
   ```
5. **Push** your branch and open a **Pull Request** against `main`

## Code Style & Conventions

- **TypeScript-first** — all code is written in TypeScript with strict mode enabled
- **ESLint** — strict mode (`--max-warnings 0`), no warnings allowed
- **Prettier** — code formatting is enforced; run `pnpm format:fix` before committing
- **Imports** — use path aliases (`@/` for app-level imports) over relative paths where available

## Commit Messages

Write clear, concise commit messages that describe _what_ changed and _why_:

```
Add player search to admin dashboard

Implement fuzzy search for the admin players table using
the existing GraphQL playerSearch query.
```

- Use the imperative mood ("Add feature" not "Added feature")
- Keep the subject line under 72 characters
- Add a body for non-trivial changes explaining context

## Pull Request Requirements

Before your PR can be merged, it must:

- [ ] Pass linting (`pnpm lint`)
- [ ] Pass type checking (`pnpm check-types`)
- [ ] Pass tests (`pnpm test`)
- [ ] Include a clear description of the changes
- [ ] Be focused — one feature or fix per PR

## Project Structure

See [INSTALLATION.md — Project Structure](./INSTALLATION.md#project-structure) for an overview of the monorepo layout.

## License

By contributing, you agree that your contributions will be licensed under the project's [Business Source License (BSL)](./LICENSE). See the license file for details.
