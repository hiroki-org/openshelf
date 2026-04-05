#!/usr/bin/env bash

set -euo pipefail

GH_REPO=${GH_REPO:?GH_REPO is required}
PR_NUMBER=${PR_NUMBER:-}
COMMENT_ON_CHANGE=${COMMENT_ON_CHANGE:-0}
OPEN_PR_LIMIT=${OPEN_PR_LIMIT:-100}
MAX_STACK_COMPARE_CANDIDATES=${MAX_STACK_COMPARE_CANDIDATES:-50}
ADMIN_BYPASS_CACHE=""

author_has_admin_bypass() {
  local pr_author="$1"
  local cached=""
  local permission=""

  if [ -z "$pr_author" ]; then
    return 1
  fi

  cached=$(
    printf '%s' "$ADMIN_BYPASS_CACHE" |
      awk -F ':' -v author="$pr_author" '$1 == author { print $2; exit }'
  )

  if [ -n "$cached" ]; then
    [ "$cached" = "1" ]
    return
  fi

  permission=$(
    gh api "repos/$GH_REPO/collaborators/$pr_author/permission" \
      --jq .permission 2>/dev/null || true
  )

  if [ "$permission" = "admin" ]; then
    ADMIN_BYPASS_CACHE="${ADMIN_BYPASS_CACHE}${pr_author}:1
"
    return 0
  fi

  ADMIN_BYPASS_CACHE="${ADMIN_BYPASS_CACHE}${pr_author}:0
"
  return 1
}

open_pr_rows=$(
  gh pr list \
    --repo "$GH_REPO" \
    --state open \
    --limit "$OPEN_PR_LIMIT" \
    --json number,headRefName,baseRefName,author \
    --jq 'sort_by(.number) | reverse | .[] | [.number, .headRefName, (.headRefName | @uri), .baseRefName, (.author.login // "")] | @tsv'
)

if [ -z "$open_pr_rows" ]; then
  echo "No open pull requests to inspect."
  exit 0
fi

find_stacked_base() {
  local pr_number="$1"
  local head_branch="$2"
  local head_branch_enc="$3"
  local stacked_base=""
  local min_ahead=""
  local stacked_base_number=""
  local compared_candidates=0

  while IFS=$'\t' read -r candidate_number candidate_head candidate_head_enc _candidate_base _candidate_author; do
    if [ -z "$candidate_head" ] ||
      [ "$candidate_number" = "$pr_number" ] ||
      [ "$candidate_number" -ge "$pr_number" ] ||
      [ "$candidate_head" = "$head_branch" ] ||
      [ "$candidate_head" = "main" ] ||
      [ "$candidate_head" = "staging" ]; then
      continue
    fi

    compared_candidates=$((compared_candidates + 1))
    if [ "$compared_candidates" -gt "$MAX_STACK_COMPARE_CANDIDATES" ]; then
      break
    fi

    local compare_line
    compare_line=$(
      gh api "repos/$GH_REPO/compare/$candidate_head_enc...$head_branch_enc" \
        --jq '"\(.status) \(.ahead_by) \(.behind_by)"' 2>/dev/null || true
    )

    if [ -z "$compare_line" ]; then
      continue
    fi

    local status ahead_by behind_by
    IFS=' ' read -r status ahead_by behind_by <<<"$compare_line"

    if [ "$status" = "ahead" ] &&
      [ "${behind_by:-1}" -eq 0 ] &&
      [ "${ahead_by:-0}" -gt 0 ]; then
      if [ -z "$min_ahead" ] ||
        [ "$ahead_by" -lt "$min_ahead" ] ||
        {
          [ "$ahead_by" -eq "$min_ahead" ] &&
            [ "$candidate_number" -lt "$stacked_base_number" ]
        }; then
        min_ahead="$ahead_by"
        stacked_base="$candidate_head"
        stacked_base_number="$candidate_number"
      fi
    fi
  done <<<"$open_pr_rows"

  printf '%s\n' "$stacked_base"
}

comment_on_change() {
  local pr_number="$1"
  local target_base="$2"

  if [ "$COMMENT_ON_CHANGE" != "1" ]; then
    return 0
  fi

  if [ "$target_base" = "staging" ]; then
    gh pr comment "$pr_number" \
      --repo "$GH_REPO" \
      --body 'このリポジトリでは staging 先行フローを採用しています。PR のターゲットを `staging` に変更しました。staging で動作確認後、`staging` → `main` の PR を作成してください。'
    return 0
  fi

  gh pr comment "$pr_number" \
    --repo "$GH_REPO" \
    --body "stacked PR を検知したため、ベースブランチを \`$target_base\` に変更しました。"
}

process_pr() {
  local pr_number="$1"
  local head_branch="$2"
  local head_branch_enc="$3"
  local base_branch="$4"
  local pr_author="$5"

  if [ "$base_branch" != "main" ]; then
    echo "PR #$pr_number is not targeting main; skipping."
    return 0
  fi

  if [ "$head_branch" = "staging" ]; then
    echo "PR #$pr_number is the expected staging -> main PR."
    return 0
  fi

  if author_has_admin_bypass "$pr_author"; then
    echo "PR #$pr_number author has admin permission; leaving target as main."
    return 0
  fi

  local target_base
  target_base=$(find_stacked_base "$pr_number" "$head_branch" "$head_branch_enc")

  if [ -z "$target_base" ]; then
    target_base="staging"
  fi

  if [ "$target_base" = "$base_branch" ]; then
    echo "PR #$pr_number already targets the expected base branch."
    return 0
  fi

  echo "Retargeting PR #$pr_number from $base_branch to $target_base"
  gh pr edit "$pr_number" --repo "$GH_REPO" --base "$target_base"
  comment_on_change "$pr_number" "$target_base"
}

if [ -n "$PR_NUMBER" ]; then
  pr_row=$(printf '%s\n' "$open_pr_rows" | awk -F '\t' -v pr="$PR_NUMBER" '$1 == pr { print; exit }')

  if [ -z "$pr_row" ]; then
    echo "PR #$PR_NUMBER is not open; nothing to do."
    exit 0
  fi

  IFS=$'\t' read -r pr_number head_branch head_branch_enc base_branch pr_author <<<"$pr_row"
  process_pr "$pr_number" "$head_branch" "$head_branch_enc" "$base_branch" "$pr_author"
  exit 0
fi

while IFS=$'\t' read -r pr_number head_branch head_branch_enc base_branch pr_author; do
  process_pr "$pr_number" "$head_branch" "$head_branch_enc" "$base_branch" "$pr_author"
done <<<"$open_pr_rows"
