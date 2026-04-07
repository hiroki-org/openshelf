#!/usr/bin/env bash

set -euo pipefail

GH_REPO=${GH_REPO:?GH_REPO is required}
HEAD_BRANCH=${HEAD_BRANCH:-main}
BASE_BRANCH=${BASE_BRANCH:-staging}
SYNC_SHA=${SYNC_SHA:-}
DRY_RUN=${DRY_RUN:-0}

encode_ref() {
  printf '%s' "$1" | jq -sRr @uri
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

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY_RUN=1, skipping PR creation."
  echo "Would create PR: $HEAD_BRANCH -> $BASE_BRANCH"
  echo "Title: $title"
  printf 'Body:\n%s\n' "$body"
  exit 0
fi

gh pr create \
  --repo "$GH_REPO" \
  --base "$BASE_BRANCH" \
  --head "$HEAD_BRANCH" \
  --title "$title" \
  --body "$body"
