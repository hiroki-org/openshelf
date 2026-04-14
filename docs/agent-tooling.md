# Agent Tooling and Knowledge Workflow

This is the canonical reference for Copilot, Codex, and other agents working in OpenShelf.

Use it when you need to choose between Dosu, Notion CLI (`ntn`), or the Notion/Dosu MCP surfaces.

## Entry points

See [`AGENTS.md`](../AGENTS.md) for the full index of agent entry points.

## What to use when

| Need | Prefer | Why |
| --- | --- | --- |
| Find repo or cross-cutting context | `dosu-init_knowledge` | Starts with knowledge discovery instead of guessing. |
| Search docs or runbooks broadly | `dosu-search_documentation` | Good for discovering relevant sources. |
| Read exact source text | `dosu-fetch_source` | Best when wording, lines, or citations matter. |
| Ask for a cited synthesis | `dosu-ask` | Use after you have enough sources. |
| Preserve a stable finding | `dosu-save_topic` | Captures reusable knowledge for later tasks. |
| Work with Notion pages, databases, files, or workers | `ntn` | CLI for workspace operations and worker management. |
| Wire Dosu into an AI tool | `dosu setup` / `dosu mcp add` | Registers Dosu MCP for the current environment. |

## Dosu CLI

`dosu --help` shows:

- `login`
- `logout`
- `status`
- `mcp`
- `setup`
- `logs`

Use the Dosu CLI when you are configuring access or MCP integration, not when you are searching content.

Helpful commands:

```bash
dosu status
dosu login
dosu setup [--deployment <id>]
dosu mcp add [-g] <tool>
dosu mcp list
```

Notes:

- `dosu setup` sets up Dosu MCP for AI tools.
- `dosu mcp add -g` adds the integration globally instead of project-local.
- `dosu status` confirms whether you are logged in and which deployment is active.
- `dosu logs` is the place to look when the integration needs debugging.

## Dosu knowledge workflow

1. Start with `dosu-init_knowledge` for unfamiliar or cross-cutting work.
2. Use `dosu-search_documentation` to find candidate sources.
3. Use `dosu-fetch_source` for exact source text.
4. Use `dosu-ask` for a cited answer once you have enough context.
5. Use `dosu-save_topic` when the finding is durable and reusable.

Other useful Dosu tools:

- `dosu-list_available_data_sources`
- `dosu-find_public_library`
- `dosu-ask_public_library`

Use Dosu knowledge tools when the task is about repo understanding, a shared runbook, a cross-file dependency, or a fact that should be reused later.

## Notion CLI (`ntn`)

`ntn --help` shows:

- `api` — public Notion API, beta
- `files` — file uploads, beta
- `pages`
- `login`
- `logout`
- `update`
- `workers`

Helpful commands:

```bash
ntn api ls
ntn api <path> --help
ntn api <path> --docs
ntn api <path> --spec
ntn pages create --content '# Title\n\nBody'
ntn files create < file.png
ntn files get <upload-id>
ntn files list
ntn workers list
ntn workers exec <KEY> --data '{...}'
```

Notes:

- `ntn api ls` reads the live OpenAPI index and does not require authentication.
- `ntn api` is the best way to inspect the public Notion API surface from the CLI.
- `ntn pages` currently focuses on creating pages from Markdown content.
- `ntn files` handles file uploads and retrieval.
- `ntn workers` manages deploy, list, exec, env, oauth, runs, sync, webhooks, and the TUI.

Common environment variables:

- `NOTION_API_TOKEN`
- `NOTION_WORKSPACE_ID`
- `NOTION_WORKERS_CONFIG_FILE`
- `NOTION_ENV`
- `NOTION_HOME`

Use `ntn` when you need to operate on Notion content directly or when you need worker lifecycle commands.

## Notion MCP / API

Notion docs describe Notion MCP for AI tools like ChatGPT, Claude, and Cursor.
The supported MCP surface includes:

- Search and fetch: `notion-search`, `notion-fetch`
- Pages: `notion-create-pages`, `notion-update-page`, `notion-move-pages`, `notion-duplicate-page`
- Databases and data sources: `notion-create-database`, `notion-update-data-source`, `notion-query-data-sources`
- Views: `notion-create-view`, `notion-update-view`, `notion-query-database-view`
- Comments: `notion-create-comment`, `notion-get-comments`
- Identity: `notion-get-teams`, `notion-get-users`, `notion-get-user`, `notion-get-self`

The Notion API also covers pages, blocks, databases, data sources, users, views, file uploads, comments, search, authentication, and link previews.

Use Notion MCP when the agent is connected directly to Notion from an AI environment. Use `ntn` when you want a CLI workflow, public API inspection, or worker management. Use `ntn api ls` if you want a quick inventory of supported endpoints.

## Dosu docs surface

The official Dosu docs (`docs.dosu.dev`) cover:

- Deployment
- Data sources
- Interactions
- Public spaces
- Auto-labeling
- Issue triage and Q&A
- Generate docs
- Maintain docs
- GitHub, Slack, and Confluence installation/configuration
- RBAC
- MCP
- Single sign-on (SSO)

That means Dosu is useful both as a documentation/search system and as an MCP integration point for agents.

## Shared rules

- Prefer official help/docs over memory.
- Prefer links over duplicated guidance.
- Save only stable, reusable knowledge.
- When saving an OpenShelf-specific topic, include the repo name and the relevant file paths.
