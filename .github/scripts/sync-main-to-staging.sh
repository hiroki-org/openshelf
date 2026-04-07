#!/usr/bin/env bash

set -euo pipefail

GH_REPO=${GH_REPO:?GH_REPO is required}
HEAD_BRANCH=${HEAD_BRANCH:-main}
BASE_BRANCH=${BASE_BRANCH:-staging}
SYNC_SHA=${SYNC_SHA:-}
DRY_RUN=${DRY_RUN:-0}
SYNC_PR_LABELS=${SYNC_PR_LABELS:-sync,automated}
SYNC_PR_ASSIGNEES=${SYNC_PR_ASSIGNEES:-}
SYNC_PR_REVIEWERS=${SYNC_PR_REVIEWERS:-}

encode_ref() {
  printf '%s' "$1" | jq -sRr @uri
}

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

parse_csv_values() {
  local csv="$1"
  local -n output_ref=$2
  local item
  output_ref=()

  IFS=',' read -r -a values <<< "$csv"
  for item in "${values[@]}"; do
    item="$(trim "$item")"
    if [ -n "$item" ]; then
      output_ref+=("$item")
    fi
  done
}

existing_pr_url=$(
  gh pr list \
    --repo "$GH_REPO" \
    --state open \
    --base "$BASE_BRANCH" \
    --head "$HEAD_BRANCH" \
    --json url \
    --jq '.[0].url // ""'
)

if [ -n "$existing_pr_url" ]; then
  echo "Sync PR already open: $existing_pr_url"
  exit 0
fi

ahead_by=$(
  gh api "repos/$GH_REPO/compare/$(encode_ref "$BASE_BRANCH")...$(encode_ref "$HEAD_BRANCH")" \
    --jq '.ahead_by // 0'
)

if [ "${ahead_by:-0}" -eq 0 ]; then
  echo "No commits to sync from $HEAD_BRANCH into $BASE_BRANCH."
  exit 0
fi

title="chore: sync $HEAD_BRANCH into $BASE_BRANCH"
body=$(
  cat <<EOF
This PR keeps \`$BASE_BRANCH\` aligned with the latest \`$HEAD_BRANCH\`.

- Triggered automatically after a push to \`$HEAD_BRANCH\`
- Merge this PR after the \`$BASE_BRANCH\` checks pass
EOF
)

if [ -n "$SYNC_SHA" ]; then
  body="${body}

Source commit: \`${SYNC_SHA}\`"
fi

declare -a label_values=()
declare -a assignee_values=()
declare -a reviewer_values=()

parse_csv_values "$SYNC_PR_LABELS" label_values
parse_csv_values "$SYNC_PR_ASSIGNEES" assignee_values
parse_csv_values "$SYNC_PR_REVIEWERS" reviewer_values

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY_RUN=1, skipping PR creation."
  echo "Would create PR: $HEAD_BRANCH -> $BASE_BRANCH"
  echo "Title: $title"
  printf 'Body:\n%s\n' "$body"
  printf 'Labels: %s\n' "${label_values[*]:-(none)}"
  printf 'Assignees: %s\n' "${assignee_values[*]:-(none)}"
  printf 'Reviewers: %s\n' "${reviewer_values[*]:-(none)}"
  exit 0
fi

for label in "${label_values[@]}"; do
  gh label create "$label" \
    --repo "$GH_REPO" \
    --description "Automated main-to-staging sync PR" \
    --color "1d76db" \
    --force
done

create_args=(
  --repo "$GH_REPO"
  --base "$BASE_BRANCH"
  --head "$HEAD_BRANCH"
  --title "$title"
  --body "$body"
)

for label in "${label_values[@]}"; do
  create_args+=(--label "$label")
done

for assignee in "${assignee_values[@]}"; do
  create_args+=(--assignee "$assignee")
done

for reviewer in "${reviewer_values[@]}"; do
  create_args+=(--reviewer "$reviewer")
done

gh pr create "${create_args[@]}"
