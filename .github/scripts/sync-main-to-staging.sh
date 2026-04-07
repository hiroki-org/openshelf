#!/usr/bin/env bash

set -euo pipefail

GH_REPO=${GH_REPO:?GH_REPO is required}
HEAD_BRANCH=${HEAD_BRANCH:-main}
BASE_BRANCH=${BASE_BRANCH:-staging}
SYNC_SHA=${SYNC_SHA:-}
DRY_RUN=${DRY_RUN:-0}

if [ "$DRY_RUN" = "1" ]; then
  echo "DRY_RUN=1, skipping staging sync."
  echo "Would sync $HEAD_BRANCH into $BASE_BRANCH for $GH_REPO"
  exit 0
fi

git fetch --no-tags origin "$HEAD_BRANCH" "$BASE_BRANCH"

if git merge-base --is-ancestor "origin/$HEAD_BRANCH" "origin/$BASE_BRANCH"; then
  echo "No commits to sync from $HEAD_BRANCH into $BASE_BRANCH."
  exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

git checkout -B "$BASE_BRANCH" "origin/$BASE_BRANCH"

if git merge-base --is-ancestor "origin/$BASE_BRANCH" "origin/$HEAD_BRANCH"; then
  echo "Fast-forwarding $BASE_BRANCH to $HEAD_BRANCH."
  git merge --ff-only "origin/$HEAD_BRANCH"
else
  merge_message="chore: sync $HEAD_BRANCH into $BASE_BRANCH"
  if [ -n "$SYNC_SHA" ]; then
    merge_message="$merge_message from $SYNC_SHA"
  fi

  echo "Creating a merge commit to reconcile $HEAD_BRANCH into $BASE_BRANCH."
  git merge -m "$merge_message" "origin/$HEAD_BRANCH"
fi

git push origin "HEAD:$BASE_BRANCH"
echo "Synced $HEAD_BRANCH into $BASE_BRANCH."
