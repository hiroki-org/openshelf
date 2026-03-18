# Specialized Agent Protocols

This document summarizes the automation protocols used by AI agents for common engineering tasks on OpenShelf.

## Protocol List

| Name | Protocol File | Usage |
| ---- | ------------- | ----- |
| **PR Review Closure Loop** | [.github/agents/pr-review-closure-loop.md](.github/agents/pr-review-closure-loop.md) | Address review comments, verify with CI, and repeat until resolved. |
| **PR Consolidation Playbook** | [.github/agents/pr-consolidation-playbook.md](.github/agents/pr-consolidation-playbook.md) | Group small related PRs or squash multiple commits for a clean history. |

## Usage for Agents

When tasked with "PR Review" or "Resolving Feedback," agents should:
1. Initialize their state using the **PR Review Closure Loop** protocol.
2. For each conversation thread, decide to `ADDRESS` or `IGNORE_WITH_REASON`.
3. Push fixes and verify CI passes (`npm run test && npm run lint`).
4. Repeat the loop until all threads are resolved and CI is green.

Refer to the individual markdown files for detailed command patterns and safety rules.
