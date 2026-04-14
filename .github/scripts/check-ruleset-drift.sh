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

repo=${GH_REPO:-${GITHUB_REPOSITORY:-}}
if [ -z "$repo" ] && [ -z "$live_json_path" ]; then
  repo=$(gh repo view --json nameWithOwner -q '.nameWithOwner')
fi

manifest_names_json="$(jq -c '[.rulesets[].name]' "$manifest_path")"
if [ "$manifest_names_json" = "[]" ]; then
  echo "::error::No rulesets were defined in $manifest_path" >&2
  exit 1
fi

normalize_rulesets() {
  local manifest_names_json="$1"

  jq -S --argjson manifest_names "$manifest_names_json" '
    (if type == "object" and has("rulesets") then .rulesets else . end)
    | {
      rulesets: [
        .[]
        | select(.name as $name | $manifest_names | index($name))
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
                contexts: (.required_status_checks.contexts // [] | sort),
                do_not_enforce_on_create: .required_status_checks.do_not_enforce_on_create,
                strict_required_status_checks_policy: .required_status_checks.strict_required_status_checks_policy
              }
            else
              ([
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
              ] | first // {
                contexts: [],
                do_not_enforce_on_create: null,
                strict_required_status_checks_policy: null
              })
            end),
            target
          }
      ] | sort_by(.name)
    }
  '
}

fetch_live_rulesets() {
  local ruleset_ids

  ruleset_ids="$(
    gh api "repos/$repo/rulesets?per_page=100" \
      --jq '.[] | .id'
  )"

  if [ -z "$ruleset_ids" ]; then
    printf '[]\n'
    return 0
  fi

  while IFS= read -r ruleset_id; do
    if [ -n "$ruleset_id" ]; then
      gh api "repos/$repo/rulesets/$ruleset_id"
    fi
  done <<<"$ruleset_ids" | jq -s '.'
}

expected_normalized=$(mktemp)
actual_normalized=$(mktemp)
cleanup() {
  rm -f "$expected_normalized" "$actual_normalized"
}
trap cleanup EXIT

normalize_rulesets "$manifest_names_json" <"$manifest_path" >"$expected_normalized"

if [ -n "$live_json_path" ]; then
  normalize_rulesets "$manifest_names_json" <"$live_json_path" >"$actual_normalized"
else
  fetch_live_rulesets | normalize_rulesets "$manifest_names_json" >"$actual_normalized"
fi

expected_count=$(jq '.rulesets | length' "$expected_normalized")
actual_count=$(jq '.rulesets | length' "$actual_normalized")
if [ "$expected_count" -gt 0 ] && [ "$actual_count" -eq 0 ]; then
  echo "::error::No repository rulesets were visible to the token used by this workflow. Verify the token can read repository rulesets." >&2
  exit 1
fi

diff_exit=0
diff -u "$expected_normalized" "$actual_normalized" || diff_exit=$?
if [ "$diff_exit" -eq 2 ]; then
  echo "::error::diff failed unexpectedly while comparing normalized rulesets." >&2
  exit 2
fi

if [ "$diff_exit" -eq 0 ]; then
  echo "✅ Ruleset manifest matches live GitHub state."
  exit 0
fi

echo "::error::Ruleset drift detected. Update .github/rulesets/required-status-checks.json to match live state." >&2
exit 1
