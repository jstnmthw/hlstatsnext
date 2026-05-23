#!/usr/bin/env bash
# PreToolUse hook for Bash: block destructive or hard-to-reverse commands.
# Returns permissionDecision=deny via JSON for matches; exits 0 for everything else.

set -u

input="$(cat)"

# Extract the command. Prefer jq, fall back to sed.
command_str=""
if command -v jq >/dev/null 2>&1; then
  command_str="$(printf '%s' "${input}" | jq -r '.tool_input.command // empty' 2>/dev/null)"
else
  command_str="$(printf '%s' "${input}" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\(.*\)"[[:space:]]*[,}].*/\1/p' | head -n 1)"
fi

[[ -z "${command_str}" ]] && exit 0

deny() {
  local reason="$1"
  # Escape the reason for JSON.
  local escaped="${reason//\\/\\\\}"
  escaped="${escaped//\"/\\\"}"
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"%s"}}\n' \
    "${escaped}"
  exit 0
}

# 1. rm -rf on home, root, or repo-critical paths.
if printf '%s' "${command_str}" | grep -Eq 'rm[[:space:]]+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-[a-zA-Z]*f[a-zA-Z]*r[a-zA-Z]*|--recursive[[:space:]]+--force|--force[[:space:]]+--recursive)[[:space:]]+(/|~|\$HOME|apps/?|packages/?|node_modules/?(\s|$)|\.git/?(\s|$))'; then
  deny "Blocked by .claude/hooks/block-dangerous.sh: rm -rf targeting /, ~, apps/, packages/, node_modules, or .git. If this is intentional, run it directly in a shell."
fi

# 2. Force push to main/master/protected branches.
if printf '%s' "${command_str}" | grep -Eq 'git[[:space:]]+push.*(--force|--force-with-lease|-f([[:space:]]|$))'; then
  if printf '%s' "${command_str}" | grep -Eq '(main|master|production|prod|release)([[:space:]]|$|:)'; then
    deny "Blocked: git push --force to a protected branch (main/master/production/release). If genuinely required, run from your shell."
  fi
fi

# 3. Prisma migrate reset without skip-seed AND without explicit confirmation.
if printf '%s' "${command_str}" | grep -Eq '(pnpm|npm|yarn|npx)?[[:space:]]*(run[[:space:]]+)?(prisma[[:space:]]+migrate[[:space:]]+reset|db:reset)'; then
  if ! printf '%s' "${command_str}" | grep -q -- '--skip-seed\|--force\|YES_I_REALLY_WANT_TO_RESET'; then
    deny "Blocked: prisma migrate reset / db:reset will drop and recreate the database. If intentional, append --force or set YES_I_REALLY_WANT_TO_RESET=1 and run directly."
  fi
fi

# 4. Docker compose down with volume removal (deletes DB data).
if printf '%s' "${command_str}" | grep -Eq 'docker[[:space:]]+compose[[:space:]]+.*down.*(-v|--volumes)'; then
  deny "Blocked: docker compose down -v will delete named volumes (database, message queue state). If intentional, run directly."
fi

# 5. git reset --hard targeting main/origin remotes.
if printf '%s' "${command_str}" | grep -Eq 'git[[:space:]]+reset[[:space:]]+--hard[[:space:]]+(origin/(main|master|production)|HEAD~[0-9]+)'; then
  deny "Blocked: git reset --hard against a remote branch or HEAD~N will discard local work. Confirm with the user and run directly."
fi

# 6. git push --force-with-lease (still requires care on main/master).
# Already covered by case 2 — explicit allow for force-with-lease on non-protected branches.

# Otherwise, allow.
exit 0
