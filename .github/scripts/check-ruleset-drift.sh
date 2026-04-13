#!/usr/bin/env bash

set -euo pipefail

manifest_path=".github/rulesets/required-status-checks.json"
live_json_path=""

usage() {
  cat <<'EOF'
Usage: check-ruleset-drift.sh [--manifest PATH] [--live-json PATH]

Compares the checked-in ruleset manifest with the live GitHub ruleset state.
When --live-json is omitted, the script fetches live state with gh api.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --manifest)
      manifest_path=${2:?--manifest requires a path}
      shift 2
      ;;
    --live-json)
      live_json_path=${2:?--live-json requires a path}
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ ! -f "$manifest_path" ]; then
  echo "::error::Manifest not found: $manifest_path" >&2
  exit 1
fi

repo=${GH_REPO:-}
if [ -z "$repo" ] && [ -z "$live_json_path" ]; then
  repo=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
fi

normalize_rulesets() {
  jq -S '
    (if type == "object" and has("rulesets") then .rulesets else . end)
    | {
      rulesets: [
        .[]
        | select(.name == "protect-main" or .name == "protect-staging")
        | {
            conditions: {
              ref_name: {
                exclude: (.conditions.ref_name.exclude // [] | sort),
                include: (.conditions.ref_name.include // [] | sort)
              }
            },
            enforcement,
            name,
            required_status_checks: (if has("required_status_checks") then
              {
                contexts: (.required_status_checks.contexts | sort),
                do_not_enforce_on_create: .required_status_checks.do_not_enforce_on_create,
                strict_required_status_checks_policy: .required_status_checks.strict_required_status_checks_policy
              }
            else
              (
                (.rules // [])[]
                | select(.type == "required_status_checks")
                | {
                    contexts: (
                      (.parameters.required_status_checks // [])
                      | map(.context)
                      | sort
                    ),
                    do_not_enforce_on_create: .parameters.do_not_enforce_on_create,
                    strict_required_status_checks_policy: .parameters.strict_required_status_checks_policy
                  }
              )
            end),
            target
          }
      ] | sort_by(.name)
    }
  '
}

expected_normalized=$(mktemp)
actual_normalized=$(mktemp)
cleanup() {
  rm -f "$expected_normalized" "$actual_normalized"
}
trap cleanup EXIT

jq -S '.' "$manifest_path" | normalize_rulesets >"$expected_normalized"

if [ -n "$live_json_path" ]; then
  jq -S '.' "$live_json_path" | normalize_rulesets >"$actual_normalized"
else
  gh api "repos/$repo/rulesets?per_page=100" | normalize_rulesets >"$actual_normalized"
fi

if diff -u "$expected_normalized" "$actual_normalized"; then
  echo "✅ Ruleset manifest matches live GitHub state."
  exit 0
fi

echo "::error::Ruleset drift detected. Update .github/rulesets/required-status-checks.json to match live state." >&2
exit 1
