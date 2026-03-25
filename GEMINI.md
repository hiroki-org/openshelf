# OpenShelf Agent Guidelines

This file provides instructions for all AI agents (Gemini, Copilot, etc.) working on this repository.

## Mandates

- **Follow Copilot Instructions**: Always adhere to the project conventions and architecture defined in [.github/copilot-instructions.md](.github/copilot-instructions.md).
- **PR Review Lifecycle**: When resolving PR review comments, follow the "PR Review Closure Loop" protocol defined in [.github/agents/pr-review-closure-loop.md](.github/agents/pr-review-closure-loop.md).

## Operational Standards

- **Context Preservation**: Read [AGENTS.md](AGENTS.md) for detailed workflows on using specialized agent tools.
- **Testing**: Ensure all changes are verified by unit tests (Vitest) and/or E2E tests (Playwright) before submitting a PR.
- **Security**: Never expose secrets or hardcode API keys. Use environment variables as specified in the instruction files.
