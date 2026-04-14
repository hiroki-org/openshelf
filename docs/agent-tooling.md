# Agent Tooling and Knowledge Workflow

This is the shared reference for Copilot, Codex, and other agents working in OpenShelf.

## Entry points

- `AGENTS.md` — universal index for any agent
- `.github/copilot-instructions.md` — repository conventions and coding workflow
- `.github/agents/pr-review-closure-loop.md` — review-thread closure loop
- `.github/agents/pr-consolidation-playbook.md` — PR consolidation workflow
- `instruction.md` — legacy guide kept for compatibility

## Tool map

| Need | Use | Notes |
| --- | --- | --- |
| Get repository or domain context | `dosu-init_knowledge` | Start here for unfamiliar or cross-cutting work. |
| Search documentation | `dosu-search_documentation` | Use for broad documentation discovery. |
| Read an authoritative source | `dosu-fetch_source` | Prefer this when exact wording or citations matter. |
| Synthesize an answer with citations | `dosu-ask` | Use after collecting enough context. |
| Capture durable knowledge | `dosu-save_topic` | Save stable, reusable findings only. |
| Find available knowledge sources | `dosu-list_available_data_sources` | Useful before broad searches. |
| Work with Notion | `ntn` | Use for Notion pages, databases, and workers. |
| Set up or authenticate Dosu | `dosu` CLI | Use for login, status, and MCP registration. |

## Dosu workflow

1. Start with `dosu-init_knowledge` when the task needs context.
2. Use `dosu-search_documentation` to find likely sources.
3. Use `dosu-fetch_source` for exact source text.
4. Use `dosu-ask` for a cited synthesis once you have enough facts.
5. Use `dosu-save_topic` when the finding is durable, actionable, and likely to help future tasks.

## Dosu CLI setup

- `dosu login` to authenticate.
- `dosu status` to confirm account and MCP configuration.
- `dosu mcp add codex -g` to register the MCP target for Codex-compatible tools.

## Notion CLI workflow

- Use `ntn` for Notion API tasks, worker operations, page updates, and database queries.
- Start with `ntn --help`, `ntn api --help`, `ntn workers --help`, and `ntn login` when setting up a session.
- If an `ntn api` subcommand cannot load its spec, retry after `ntn login` or confirm the target workspace is reachable.
- Keep Notion work separate from repo code changes unless the task explicitly requires both.

## Shared rules

- Prefer links over duplicated guidance.
- Keep task-specific procedures in the specialized playbooks.
- Save knowledge only when it will stay useful across future tasks.
- When a finding is specific to OpenShelf, include the repo name plus the relevant file paths in the saved topic.
