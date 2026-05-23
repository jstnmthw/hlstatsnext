#!/usr/bin/env bash
# PostToolUse hook for Edit|Write: run prettier on the edited file if applicable.
# Silent on success. Emits stderr on error so Claude can react. Does NOT run lint
# or type check (Husky pre-commit handles that).

set -u

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" 2>/dev/null || exit 0

# Read tool input from stdin.
input="$(cat)"

# Extract the file_path from Edit or Write tool input. Prefer jq when available,
# otherwise fall back to a sed-based extractor that handles the common shape.
file_path=""
if command -v jq >/dev/null 2>&1; then
  file_path="$(printf '%s' "${input}" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
else
  file_path="$(printf '%s' "${input}" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
fi

# Bail if no file path was extracted.
[[ -z "${file_path}" ]] && exit 0

# Skip if the file is outside the project directory.
case "${file_path}" in
  "${CLAUDE_PROJECT_DIR:-$(pwd)}"/*) ;;
  /*) exit 0 ;;
  *) file_path="${CLAUDE_PROJECT_DIR:-$(pwd)}/${file_path}" ;;
esac

# Skip if the file no longer exists (Edit on a moved/deleted target).
[[ -f "${file_path}" ]] || exit 0

# Format-eligible extensions only.
case "${file_path}" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.md|*.mdx|*.css|*.scss|*.html|*.yaml|*.yml) ;;
  *) exit 0 ;;
esac

# Skip generated, vendored, and ignored paths.
case "${file_path}" in
  */node_modules/*|*/.next/*|*/.turbo/*|*/dist/*|*/build/*|*/__generated__/*|*/.git/*) exit 0 ;;
esac

# Run prettier; suppress stdout, surface stderr only on failure.
if ! output="$(pnpm exec prettier --write --log-level warn "${file_path}" 2>&1)"; then
  printf 'prettier failed on %s:\n%s\n' "${file_path}" "${output}" >&2
  exit 1
fi

exit 0
