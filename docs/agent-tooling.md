# Agent Tooling and Knowledge Workflow

This is the canonical OpenShelf reference for agents choosing between Dosu, Notion CLI (`ntn`), and the Notion or Dosu MCP surfaces.

Use this document for repo-specific workflow guidance. If your machine also has a shared home-level Dosu bundle installed, treat that as a local setup companion rather than the OpenShelf source of truth.

## Entry points

See [`AGENTS.md`](../AGENTS.md) for the full index of agent entry points.

## What to use when

| Need | Prefer | Why |
| --- | --- | --- |
| Build a first-pass mental model of the repo or an unfamiliar subsystem | `init_knowledge` | Starts from existing knowledge instead of guessing. |
| Search docs, runbooks, or policy pages broadly | `search_documentation` | Good for discovering candidate sources before reading details. |
| Read exact source text with citations or line ranges | `fetch_source` | Best when wording, line references, or precise excerpts matter. |
| Target a specific indexed repo or workspace before synthesis | `list_available_data_sources` | Helps keep `ask` focused on the right source set. |
| Ask for a cited synthesis across one or more indexed sources | `ask` | Best after you know the relevant sources or question scope. |
| Preserve a stable finding for future work | `save_topic` | Captures reusable knowledge for later tasks. |
| Research a supported public OSS repository | `find_public_library` -> `ask_public_library` | Finds the supported slug first, then asks a cited question. |
| Work with Notion pages, databases, files, or workers from the shell | `ntn` | Best for direct CLI workflows and worker lifecycle commands. |
| Wire Dosu into an AI tool locally or globally | `dosu setup` / `dosu mcp add` | Registers Dosu MCP for the current environment. |

## Dosu CLI

`dosu --help` currently exposes:

- `login`
- `logout`
- `status`
- `mcp`
- `setup`
- `logs`

Use the Dosu CLI when you are configuring access or MCP integration, not when you are retrieving knowledge.

Helpful commands:

```bash
dosu status
dosu login
dosu setup [--deployment <id>]
dosu mcp list
dosu mcp add [-g] <tool>
dosu logs
```

Notes:

- `dosu setup` bootstraps Dosu MCP for supported AI tools.
- `dosu mcp add -g` installs the integration globally instead of project-local.
- `dosu mcp list` is the fastest way to confirm which tool names are supported on the current machine.
- `dosu status` confirms whether you are logged in and which deployment is active.
- `dosu logs` is the place to look when the integration needs debugging.

## Dosu knowledge workflow

1. Start with `init_knowledge` for unfamiliar, cross-cutting, or exploratory work.
2. Use `search_documentation` to find raw docs and runbooks that may not yet be promoted into curated knowledge.
3. Use `fetch_source` for exact source text, and prefer narrow line ranges.
4. Before `ask`, run `list_available_data_sources` unless you already know the relevant source IDs.
5. Use `ask` for a cited answer once the question and source scope are clear.
6. Use `save_topic` only when the finding is durable, reusable, and no longer just in-progress investigation.

OpenShelf rule of thumb:

- Repo-specific data source IDs, prompt recipes, and operational gotchas belong in repo docs or saved topics, not in a generic home-level setup note.

When saving an OpenShelf topic, include:

- the repository name
- the relevant file paths
- the operational lesson that should still matter in future runs

## Notion CLI (`ntn`)

`ntn --help` currently exposes:

- `api` — public Notion API, beta
- `files` — file uploads, beta
- `pages`
- `login`
- `logout`
- `update`
- `workers`

`ntn workers --help` currently exposes:

- `capabilities`
- `create`
- `delete`
- `deploy`
- `new`
- `env`
- `exec`
- `get`
- `oauth`
- `list`
- `runs`
- `sync`
- `webhooks`
- `tui`

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

- `ntn api` is the best way to inspect the public Notion API surface from the CLI.
- `ntn api ls` depends on the live OpenAPI spec and may fail temporarily if that spec cannot be fetched.
- `ntn pages` focuses on creating pages from Markdown content.
- `ntn files` handles file uploads and retrieval.
- `ntn workers` covers worker deployment, execution, environment variables, OAuth, runs, sync, webhooks, and the TUI.

Common environment variables:

- `NOTION_API_TOKEN`
- `NOTION_WORKSPACE_ID`
- `NOTION_WORKERS_CONFIG_FILE`
- `NOTION_ENV`
- `NOTION_HOME`

Use `ntn` when you need to operate on Notion content directly, inspect the public API from the shell, or manage worker lifecycle commands.

## Notion MCP / API

Notion provides MCP support for AI tools like ChatGPT, Claude, and Cursor. Exact tool names can vary by environment, but the typical surface includes:

- search and fetch
- page create, update, move, and duplicate
- database and data source create or update
- view create, update, and query
- comments and discussion threads
- users, teams, and workspace identity

Use Notion MCP when the agent is already connected directly to Notion from an AI environment. Use `ntn` when you want a CLI workflow, worker management, or public API inspection from the shell.

## Dosu docs surface

The official Dosu docs ([docs.dosu.dev](https://docs.dosu.dev/)) cover:

- deployment and channels
- data sources
- MCP
- issue triage and Q&A
- generated and maintained docs
- GitHub, Slack, and Confluence integrations
- RBAC
- SSO

That means Dosu is useful both as a documentation and search system and as an MCP integration point for agents.

## Shared rules

- Prefer official help output and official docs over memory.
- Prefer links over duplicated guidance.
- Save only stable, reusable knowledge.
- Keep machine-specific setup in home-level docs and OpenShelf-specific rules in this repo.
