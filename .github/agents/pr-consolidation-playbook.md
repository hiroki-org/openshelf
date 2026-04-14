---
name: PR Consolidation Playbook
description: "Use when consolidating many similar open PRs into fewer target PRs by grouping, selecting destinations, merging source branches, and closing absorbed PRs with traceability."
tools:
  - execute
  - read
  - search
  - github_repo
  - mcp_github_github_list_pull_requests
  - mcp_github_github_pull_request_read
  - mcp_github_github_add_reply_to_pull_request_comment
argument-hint: "Provide owner/repo and consolidation policy (grouping keys, destination preference, merge strategy)."
user-invocable: true
---

# PR Consolidation Playbook

This document defines a repeatable workflow for consolidating many similar open PRs into a smaller set of target PRs.

Shared tooling reference: `../../AGENTS.md` and `../../docs/agent-tooling.md`.

## Objective

- Group similar PRs by scope (e.g., same file, same feature area, same intent).
- Pick one destination PR per group.
- Merge source branches into destination branch.
- Keep only consolidated destination PRs open to `main`.

## Steps

1. **Inventory open PRs**
   - Collect: PR number, title, head branch, changed files, review state.
2. **Group by similarity**
   - Primary key: touched files.
   - Secondary key: change intent (tests/code-health/perf/docs/bugfix).
3. **Select destination PR per group**
   - Prefer the newest or most complete PR in the group.
4. **Integrate source branches**
   - Checkout destination branch.
   - Merge each source branch.
   - Resolve conflicts with destination behavior as baseline.
5. **Accept review feedback**
   - If feedback indicates regression risk, apply fixes on destination branch.
   - Run related tests/build for touched scope.
6. **Push and update destination PR metadata**
   - Edit title/body to explicitly state it is a consolidated PR.
   - List absorbed PR numbers in the description.
7. **Close absorbed PRs**
   - Comment with destination PR mention.
   - Close PR and delete source branch.
8. **Post-push resolve loop**
   - Repeat: sleep → check required CI → reply/resolve unresolved review threads.
   - Stop when required checks are green and unresolved threads are zero.

## Suggested Close Comment Template

`このPRは #<destination> に統合しました。以降のレビューは統合先PRでお願いします。`

## Suggested Destination PR Body Section

```md
## Consolidation

This PR consolidates related PRs:
- #...
- #...

Notes:
- Main-merge is intentionally deferred until consolidated review and CI complete.
```
