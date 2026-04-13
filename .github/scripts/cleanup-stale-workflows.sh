#!/usr/bin/env bash

set -euo pipefail

GH_REPO=${GH_REPO:?GH_REPO is required}
DRY_RUN=${DRY_RUN:-1}

default_branch="$(
  gh api "repos/$GH_REPO" --jq '.default_branch'
)"

if [ -z "$default_branch" ]; then
  echo "Could not determine the default branch for $GH_REPO." >&2
  exit 1
fi

workflow_rows="$(
  gh api --paginate "repos/$GH_REPO/actions/workflows" \
    --jq '.workflows[]
      | select(.state == "active")
      | [.id, .name, .path] | @tsv'
)"

if [ -z "$workflow_rows" ]; then
  echo "No active workflows found."
  exit 0
fi

stale_count=0
disabled_count=0

workflow_exists_on_default_branch() {
  local workflow_path="$1"

  gh api "repos/$GH_REPO/contents/$workflow_path?ref=$default_branch" >/dev/null 2>&1
}

disable_workflow() {
  local workflow_id="$1"
  gh api --method PUT "repos/$GH_REPO/actions/workflows/$workflow_id/disable" >/dev/null
}

while IFS=$'\t' read -r workflow_id workflow_name workflow_path; do
  if [ -z "$workflow_id" ]; then
    continue
  fi

  if [[ "$workflow_path" != .github/workflows/* ]]; then
    echo "Skipping non-file-backed workflow: $workflow_name ($workflow_path)"
    continue
  fi

  if workflow_exists_on_default_branch "$workflow_path"; then
    echo "OK: $workflow_name ($workflow_path)"
    continue
  fi

  stale_count=$((stale_count + 1))
  echo "Stale: $workflow_name ($workflow_path)"

  if [ "$DRY_RUN" = "1" ]; then
    echo "Dry run: would disable workflow id $workflow_id"
    continue
  fi

  disable_workflow "$workflow_id"
  disabled_count=$((disabled_count + 1))
  echo "Disabled workflow id $workflow_id"
done <<<"$workflow_rows"

echo "Summary: stale=$stale_count disabled=$disabled_count dry_run=$DRY_RUN"
