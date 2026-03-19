# Specialized Agent Protocols

This document summarizes the automation protocols used by AI agents for common engineering tasks on OpenShelf.

## Protocol List

| Name | Protocol File | Usage |
| ---- | ------------- | ----- |
| **PR Review Closure Loop** | [.github/agents/pr-review-closure-loop.md](.github/agents/pr-review-closure-loop.md) | Address review comments, verify with CI, and repeat until resolved. |
| **PR Consolidation Playbook** | [.github/agents/pr-consolidation-playbook.md](.github/agents/pr-consolidation-playbook.md) | Group small related PRs or squash multiple commits for a clean history. |

## Available Skills

Skills are reusable automation patterns for specific tasks. Invoke with `/skill-name` or the Skill tool.

| Skill Name | Purpose | Input | Output |
|-----------|---------|-------|--------|
| `typecheck-fix` | Fix TypeScript type errors across workspace | PR number (optional) | Fixed files + CI status |
| `test-and-lint` | Run full test suite + linting validation | Branch name | Test results + pass/fail |
| `pr-review-respond` | Batch process open PR reviews and suggestions | PR number | Updated PR with replies + resolved threads |
| `pr-status-check` | Monitor CI status and report blockers | PR number(s) | Status summary + action items |
| `commit-and-push` | Stage, commit with standard message, push branch | Commit message | Git push output + PR creation prompt |

## Specialized Agents

Use these agents for complex multi-step tasks:

### Explore Agent (`subagent_type: Explore`)
**When to use**: Need to understand codebase patterns, architecture, or find related code
- Finding all references to a function/class
- Understanding code relationships across files
- Mapping project structure for a new feature
- Investigating where to add new functionality

**Example**: *"Explore where organization selection is currently implemented in the codebase"*

### Plan Agent (`subagent_type: Plan`)
**When to use**: Designing implementation approach before writing code
- Multi-file changes with interdependencies
- Architecture decisions (where to place new code)
- API design (new endpoints, request/response shapes)
- Database schema changes

**Example**: *"Plan the implementation for adding dark mode toggle to settings"*

### General Purpose Agent
**When to use**: Complex workflows that need web searches, file analysis, or multi-step reasoning
- Investigating why tests fail and planning fixes
- Analyzing error logs and proposing solutions
- Coordinating multiple file changes
- Researching external library integration

## Usage for Agents

When tasked with "PR Review" or "Resolving Feedback," agents should:
1. Check all open PRs via `gh pr list --state open`
2. For each PR, fetch review comments: `gh pr view <PR#> --json reviews`
3. Initialize PR Review Closure Loop protocol
4. For each conversation thread, decide to `ADDRESS` or `IGNORE_WITH_REASON`
5. Push fixes and verify CI passes:
   ```bash
   npm run typecheck && npm run test && npm run lint
   ```
6. Repeat the loop until all threads are resolved and CI is green

### Step-by-Step: Handling Type Check Failures

1. **Identify the error**:
   ```bash
   npm run typecheck 2>&1 | grep error
   ```

2. **Fix the issue**:
   - Type annotations missing → add explicit types
   - Promise type mismatch → ensure return type is `Promise<T>`
   - Template literal mismatches → verify string/number compatibility

3. **Verify**:
   ```bash
   npm run typecheck
   ```

4. **Commit**:
   ```bash
   git add -A && git commit -m "fix(typecheck): Resolve TypeScript type errors"
   git push
   ```

5. **Check CI**:
   ```bash
   gh pr view <PR#> --json statusCheckRollup | grep -i typecheck
   ```

### Step-by-Step: Code Review Response

1. **Fetch all reviews for a PR**:
   ```bash
   gh pr view <PR#> --json reviews --jq '.reviews[] | {author: .author.login, state: .state, body: .body}'
   ```

2. **Read each comment and decide**:
   - If actionable → implement fix
   - If already done → reply "✅ Already implemented in commit X"
   - If out of scope → defer with issue reference

3. **Reply to conversation**:
   ```bash
   gh pr comment <PR#> --body "✅ Fixed in commit $(git rev-parse --short HEAD). Changes: <desc>"
   ```

4. **Resolve thread** (via GitHub web UI after approval, or mark as reviewed)

## Automation Patterns

### Pattern: Type Check + Test Loop
Use when CI has failures and you need to iterate quickly:

```bash
# 1. Run checks locally
npm run typecheck 2>&1 | head -20

# 2. Fix issues
# (edit files)

# 3. Verify fix
npm run typecheck && npm run test -- <affected-test>

# 4. Push and wait for CI
git add && git commit -m "fix: ..." && git push
sleep 30 && gh pr checks <PR#>
```

### Pattern: PR Review Batch Processing
Use when handling multiple review comments:

```bash
# 1. Fetch all conversations
gh pr view <PR#> --json reviews

# 2. Process each comment
for comment in $(gh pr view <PR#> --json reviews --jq '.[].id'); do
  # Implement fix or respond
done

# 3. Verify all resolved
gh pr view <PR#> --json reviews | grep -c "COMMENTED"
```

### Pattern: Monitor Recurring Issues
Use `/loop` skill to set up recurring checks:

```bash
/loop 5m "gh pr list --state open --json number,statusCheckRollup | grep -i fail"
```

This checks every 5 minutes for failing PRs and posts summary.

## Reference: Key Files

- **Copilot Instructions**: `.github/copilot-instructions.md` – Full project guide
- **Agent Protocols**: `.github/agents/*.md` – Detailed workflow docs
- **Project Commands**: Root `package.json` – Available npm scripts
- **Skills Registry**: `.github/skills/` – Reusable automation scripts (if added)

Refer to `.github/copilot-instructions.md` for:
- Architecture overview
- API endpoint reference
- Database schema
- Test patterns
- Deployment instructions

