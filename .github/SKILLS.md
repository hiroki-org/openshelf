# OpenShelf Automation Skills Catalog

This document defines reusable automation skills for common engineering tasks. Skills can be invoked via `/skill-name` notation or triggered by agents.

## Table of Contents

1. [typecheck-fix](#typecheck-fix) – Fix TypeScript type errors
2. [test-and-lint](#test-and-lint) – Validate code quality
3. [pr-review-respond](#pr-review-respond) – Address code review comments
4. [pr-status-check](#pr-status-check) – Monitor CI and report blockers
5. [commit-and-push](#commit-and-push) – Standardized commit workflow
6. [refactor-duplicates](#refactor-duplicates) – Remove code duplication
7. [db-schema-update](#db-schema-update) – Database migration workflow

---

## typecheck-fix

**Purpose**: Identify and fix TypeScript type errors across the workspace

**Typical Triggers**:
- CI "Type Check" step fails
- User requests: "Fix TypeScript errors"
- PR review feedback: "Type annotation missing"

**Workflow**:

```bash
# 1. Identify all errors
npm run typecheck 2>&1 > typecheck-errors.log

# 2. Parse errors and fix systematically
# Common patterns:
#   - Promise<>type mismatch → add return type annotation `Promise<T>`
#   - Missing type annotations → infer from context or declare explicit type
#   - String/number intersection → verify template literal types

# 3. Verify fix
npm run typecheck

# 4. Commit and create/update PR
git add -A
git commit -m "fix(typecheck): Resolve TypeScript compilation errors"
git push
```

**Input Parameters**:
- `pr_number` (optional) – If fixing CI failure in a PR
- `target_files` (optional) – Specific files to focus on

**Output**:
- ✅ All TypeScript errors resolved
- ✅ `npm run typecheck` passes locally
- ✅ Commit pushed to branch
- CI status: `gh pr checks <PR#>`

**Success Criteria**:
- No errors in typecheck output
- CI Type Check job passes (green status)
- No new type errors introduced in other files

---

## test-and-lint

**Purpose**: Run full test suite and linting validation

**Typical Triggers**:
- Before committing code
- CI validation (automated step)
- User requests: "Validate changes"

**Workflow**:

```bash
# 1. Run tests
npm run test

# 2. Run linter
npm run lint

# 3. Auto-fix lint issues (where possible)
npm run lint -- --fix

# 4. Review non-auto-fixable lint issues
# (manual fixes as needed)

# 5. Verify again
npm run typecheck && npm run test && npm run lint

# 6. Commit if all pass
git add -A
git commit -m "fix(validation): Resolve test and lint failures"
git push
```

**Input Parameters**:
- `test_filter` (optional) – Run specific tests: `npm run test -- <pattern>`
- `fix_lint` (default: true) – Auto-fix lint issues

**Output**:
- Test results: count of pass/fail/skip
- Lint violations: count by category
- Coverage report (if enabled)
- All fixes applied and staged

**Success Criteria**:
- All tests pass
- No lint violations (or all auto-fixed)
- No new failures introduced

---

## pr-review-respond

**Purpose**: Batch process open PR review comments and generate responses

**Typical Triggers**:
- Code review feedback received on PR
- User requests: "Address PR reviews"
- Agent workflow: "Respond to all open review comments"

**Workflow**:

```bash
# 1. Fetch all open PRs
gh pr list --state open --json number,title

# 2. For each PR with reviews:
for PR in 157 156 155; do
  # 3. Fetch review comments
  gh pr view $PR --json reviews

  # 4. For each comment, decide:
  #    a) ACTION: Implement fix
  #       → Apply changes, commit, push
  #       → Reply: "✅ Fixed in commit <hash>"
  #    b) DEFER: Out of scope
  #       → Reply: "📋 Tracked as #XYZ for future"
  #    c) CLARIFY: Need more info
  #       → Reply: "❓ Clarification needed: <question>"

  # 5. Commit changes if any
  git add -A
  git commit -m "Address review feedback: <summary>"
  git push

  # 6. Reply to conversation
  gh pr comment $PR --body "✅ Applied in commit $(git rev-parse --short HEAD)"
done

# 7. Monitor CI
sleep 300 && gh pr checks 157 157 156 155
```

**Input Parameters**:
- `pr_numbers` – List of PR numbers to process
- `auto_fix` (default: true) – Automatically fix suggestions where possible
- `require_approval` (default: true) – Wait for approval before marking resolved

**Output**:
- For each review comment:
  - ✅ Fix applied (with commit hash), OR
  - 📋 Deferred with issue reference, OR
  - ❓ Reply with clarification needed
- Updated PR with replies
- CI status for each PR

**Success Criteria**:
- All actionable comments addressed
- All deferred comments reference a tracking issue
- CI status is green for all affected PRs
- All conversation threads marked as resolved (if approved)

### Persistent Loop Addendum (Required for "do not stop" requests)

When users request persistent looping (e.g., "keep running", "stopしない", "at least 5 loops"), `pr-review-respond` must:

1. Execute a minimum fixed number of cycles before reporting completion.
2. Track cycles in SQL tables to avoid premature success snapshots.
3. In each cycle, inspect not only review threads but also:
   - normal PR comments (codecov/codspeed/greptile/vercel/coderabbit/gemini/jules),
   - PR description/body updates,
   - review events feed.
4. Post concise timeline follow-up comments with action/no-action decisions for bot signals.
5. Re-run closure handling immediately if new unresolved threads appear mid-cycle.

Suggested SQL tracking schema:

```sql
CREATE TABLE IF NOT EXISTS pr_loop_runs (
  cycle_no INTEGER PRIMARY KEY,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  open_pr_count INTEGER,
  unresolved_before INTEGER,
  unresolved_after INTEGER,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS pr_loop_pr_status (
  cycle_no INTEGER NOT NULL,
  phase TEXT NOT NULL, -- before/after
  pr_number INTEGER NOT NULL,
  unresolved INTEGER,
  req_non_success INTEGER,
  bot_followup_needed INTEGER,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (cycle_no, phase, pr_number)
);
```

---

## pr-status-check

**Purpose**: Monitor CI status and report blockers for open PRs

**Typical Triggers**:
- User requests: "Check PR status"
- Scheduled: `/loop 10m pr-status-check`
- Automated: After each PR push

**Workflow**:

```bash
# 1. Fetch all open PRs
gh pr list --state open --json number,title,statusCheckRollup

# 2. For each PR, extract:
#    - Number of passing checks
#    - Number of failing checks
#    - List of failing jobs
#    - Estimated time to completion

# 3. Generate status report:
#    [PR #157] ✅ Org Selection Feature
#      - Type Check ✅
#      - Tests ✅
#      - Lint ✅
#
#    [PR #156] ❌ Test Coverage
#      - CodeRabbit suggestions: 3 unresolved
#      - Type Check: FAILED (fix typecheck errors)
#      → Action: Run typecheck-fix skill

# 4. Identify blockers and recommend actions
# 5. Post summary comment or output
```

**Input Parameters**:
- `pr_numbers` (optional) – Check specific PRs only
- `summary_only` (default: false) – Only report blockers, not passing checks
- `detailed` (default: false) – Include detailed logs for failures

**Output**:
- Summary table of PR status
- List of failing jobs per PR
- Recommended actions (e.g., "Run typecheck-fix for PR #157")
- Estimated time to resolution

**Success Criteria**:
- All PRs have green CI status, OR
- Blockers are clearly identified with recommended fixes

---

## commit-and-push

**Purpose**: Standardized commit workflow with conventional commit messages

**Typical Triggers**:
- After completing implementation
- After fixing code review feedback
- User requests: "Commit changes as: fix(typecheck): ..."

**Workflow**:

```bash
# 1. Stage changes
git add -A

# 2. Generate commit message
# Format: <type>(<scope>): <subject>
# Types: feat, fix, refactor, test, docs, style, perf, chore
# Example: fix(typecheck): Resolve TypeScript type errors

# 3. Show diff for review
git diff --cached

# 4. Commit
git commit -m "<type>(<scope>): <subject>

<optional body: explain why, not what>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# 5. Push with upstream tracking
git push -u origin <branch-name>

# 6. Output:
# - Commit hash
# - Changed files
# - Suggestion to open PR (if new branch)
```

**Input Parameters**:
- `message` – Commit message (type and scope auto-inferred if not provided)
- `branch` (optional) – Create new branch before committing
- `create_pr` (default: true) – Suggest PR creation after push

**Output**:
- Commit hash
- Files changed
- Branch pushed
- PR creation URL (if applicable)

**Success Criteria**:
- Commit created with proper conventional format
- Changes pushed to remote
- No uncommitted changes remaining locally

---

## refactor-duplicates

**Purpose**: Identify and remove code duplication

**Typical Triggers**:
- Code review feedback: "Refactor duplicated code"
- User requests: "Extract common test setup"
- Automated: Duplication metrics exceed threshold

**Workflow**:

```bash
# 1. Identify duplicated code patterns
npm run lint -- --detect-duplicates  # if available, or use custom tool

# 2. Locate instances:
#    - setupApiMocks() appears in 5 test files
#    - Similar error handling in 3 API routes
#    - Paper validation logic duplicated

# 3. Refactor strategy:
#    Option A: Extract to shared utility
#    Option B: Base class or mixin
#    Option C: Helper function in test setup

# 4. Implement refactoring:
# Example: Extract test helper
# Before:
#   vi.mocked(apiFetch).mockImplementation(...) // in 5 files
# After:
#   setupApiMocks() // in shared test helpers

# 5. Update all call sites
# 6. Run tests to verify behavior unchanged
npm run test

# 7. Measure improvement:
#   Lines of code removed: 120
#   Duplicated lines reduced: 95%

# 8. Commit
git commit -m "refactor: Extract common test setup helpers

- Created setupApiMocks() helper to reduce duplication
- Updated 5 test files to use new helper
- No functional changes; tests still pass"
```

**Input Parameters**:
- `threshold` (default: 3) – Minimum occurrences to trigger refactoring
- `scope` (optional) – Focus on specific directory: `apps/web/src/app/upload/__tests__`

**Output**:
- Identified duplication instances
- Refactoring proposal (with before/after code)
- Lines of code saved
- Commit with changes applied

**Success Criteria**:
- All tests pass after refactoring
- Duplicated code reduced by ≥50%
- No functional changes introduced

---

## db-schema-update

**Purpose**: Update database schema and generate migrations

**Typical Triggers**:
- Schema change requested (new table/column)
- User requests: "Add created_at timestamp to papers table"
- Code review: "Schema change requires migration"

**Workflow**:

```bash
# 1. Modify schema file
#    File: apps/api/src/db/schema.ts
#    Example: Add created_at column
export const papers = sqliteTable("papers", {
  // ... existing columns
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

# 2. Generate migration
npm run db:generate

# 3. Review generated migration
#    File: apps/api/drizzle/<timestamp>_<name>.sql
#    Verify: ALTER TABLE statements, constraints, defaults

# 4. Test locally
npm run db:migrate:local

# 5. Run affected tests
npm run test apps/api/src/routes/__tests__/papers.test.ts

# 6. Verify no regressions
npm run test

# 7. Commit migration and schema changes
git add apps/api/src/db/schema.ts apps/api/drizzle/*.sql
git commit -m "feat(db): Add created_at timestamp to papers table

- New column: papers.created_at with default CURRENT_TIMESTAMP
- Migration generated: <timestamp>_add_papers_created_at.sql
- All tests passing"

# 8. Deploy (manual step with caution):
# npm run db:migrate:remote  # Only in actual deploy flow
```

**Input Parameters**:
- `schema_changes` – Description of changes
- `test_locally` (default: true) – Run migrations + tests locally first
- `skip_deploy` (default: true) – Don't auto-deploy to production

**Output**:
- Generated migration file(s)
- Schema changes reflected in TypeScript types
- Test results confirming no regressions
- Safe commit ready to merge

**Success Criteria**:
- Migration generates without errors
- Local migration applies successfully
- All tests pass with new schema
- Schema types correctly match database

---

## Skill Invocation Examples

### Example 1: Fix TypeScript Errors
```
User: "Fix the type check failures in PR #157"
→ Skill invokes: typecheck-fix
→ 1. Run npm run typecheck
→ 2. Fix Promise<Response> type mismatch
→ 3. Verify with npm run typecheck
→ 4. Commit and push changes
→ Result: PR #157 CI Type Check passes ✅
```

### Example 2: Process Multiple PR Reviews
```
User: "Address all open PR review comments"
→ Skill invokes: pr-review-respond
→ 1. Fetch open PRs: #157, #156
→ 2. For PR #157: Implement 2 fixes, mark 1 as deferred
→ 3. For PR #156: Address 3 CodeRabbit suggestions
→ 4. Commit changes to each branch
→ 5. Monitor CI for both PRs
→ Result: All reviews addressed, CI green ✅
```

### Example 3: Automated Status Monitoring
```
User: "/loop 10m pr-status-check"
→ Skill runs every 10 minutes:
→ 1. Check all open PRs
→ 2. Report failing jobs
→ 3. Suggest fixes (e.g., "Run typecheck-fix for PR #157")
→ 4. Repeat until all PRs pass or explicitly stopped
→ Result: Continuous monitoring without manual checks
```

---

## Extending the Skill Catalog

To add new skills:

1. **Create skill definition** in this file following the template:
   ```markdown
   ## skill-name

   **Purpose**: ...
   **Typical Triggers**: ...
   **Workflow**: ...
   **Input Parameters**: ...
   **Output**: ...
   **Success Criteria**: ...
   ```

2. **Implement automation logic** as:
   - Reusable Agent prompt/script
   - Bash function (if simple)
   - Full agent implementation (if complex)

3. **Document in AGENTS.md** if it's core to workflows

4. **Test with real scenarios** before marking as stable

---

## Skill Stability Levels

- 🟢 **Stable** – Well-tested, ready for production use
- 🟡 **Beta** – Works but needs refinement, feedback welcome
- 🔴 **Experimental** – Early draft, testing required

All skills in this document are **🟢 Stable** unless otherwise marked.
