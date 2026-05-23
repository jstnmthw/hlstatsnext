#!/usr/bin/env bash
# SessionStart hook: emit git + workspace state as additionalContext for Claude.
# Fast (<200ms). Falls back gracefully if any subcommand fails.

set -u

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}" 2>/dev/null || exit 0

branch="$(git branch --show-current 2>/dev/null || echo 'unknown')"
status_short="$(git status --short 2>/dev/null || true)"
changed_count="$(printf '%s\n' "$status_short" | grep -cv '^$' || echo 0)"
changed_first10="$(printf '%s\n' "$status_short" | head -n 10)"

# Ahead/behind vs origin/main, falling back to origin/master.
ahead_behind=""
if upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null)"; then
  counts="$(git rev-list --left-right --count "${upstream}...HEAD" 2>/dev/null || true)"
  if [[ -n "${counts}" ]]; then
    behind="$(printf '%s' "${counts}" | awk '{print $1}')"
    ahead="$(printf '%s' "${counts}" | awk '{print $2}')"
    ahead_behind="ahead ${ahead}, behind ${behind} vs ${upstream}"
  fi
fi

# Stale install detection: lockfile newer than node_modules sentinel.
stale_install="false"
if [[ -f pnpm-lock.yaml ]]; then
  lock_mtime="$(stat -c %Y pnpm-lock.yaml 2>/dev/null || stat -f %m pnpm-lock.yaml 2>/dev/null || echo 0)"
  nm_sentinel=".modules.yaml"
  nm_mtime=0
  if [[ -f "node_modules/${nm_sentinel}" ]]; then
    nm_mtime="$(stat -c %Y "node_modules/${nm_sentinel}" 2>/dev/null || stat -f %m "node_modules/${nm_sentinel}" 2>/dev/null || echo 0)"
  fi
  if [[ "${lock_mtime}" -gt "${nm_mtime}" ]]; then
    stale_install="true"
  fi
fi

context=""
context+="git branch: ${branch}"$'\n'
if [[ -n "${ahead_behind}" ]]; then
  context+="git sync: ${ahead_behind}"$'\n'
fi
context+="uncommitted files: ${changed_count}"$'\n'
if [[ "${changed_count}" -gt 0 ]]; then
  context+="changed (first 10):"$'\n'"${changed_first10}"$'\n'
fi
if [[ "${stale_install}" == "true" ]]; then
  context+="pnpm install appears stale — pnpm-lock.yaml newer than node_modules/.modules.yaml (run 'pnpm install')"$'\n'
fi

# Emit as JSON. Avoid jq dependency by escaping manually.
escape_json() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '%s' "$s"
}

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' \
  "$(escape_json "${context}")"
