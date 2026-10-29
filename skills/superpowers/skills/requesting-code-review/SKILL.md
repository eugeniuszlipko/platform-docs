---
name: requesting-code-review
description: "Level 3 only: dispatch a fresh reviewer that checks finished work against the plan/spec (plan alignment, quality, tests). Complements, does not replace, the ECC specialist reviewers."
---

> **Workspace notes**
> - Vendored from obra/superpowers v7.0.0 (commit bb92f77, MIT; see platform-docs/skills/superpowers/LICENSE), read in full and adopted 2026-10-16. Loaded only through the `superpowers-routing` meta-skill (level 3). Priority: root AGENTS.md → `meta-planning` → `superpowers-routing` → this file.
> - `superpowers:<name>` references were rewritten to bare names. Skills NOT vendored (using-git-worktrees, test-driven-development, finishing-a-development-branch, the brainstorming visual companion) are inert: ignore references to them and follow `superpowers-routing` (sections «Тесты», «Git», «Завершение»).
> - This is the plan-conformance review. After it, the layer specialists (react-reviewer, database-reviewer, security-auditor, a11y-architect, silent-failure-hunter, seo-specialist) still run once per the «Ревьюеры по слоям» table in `platform-docs/skills/ecc/README.md`. Reviewers are read-only.
> - Model: dispatch this reviewer with `model: opus` when it is the final whole-branch review (one per phase); a mid-task check on a small diff uses `sonnet`. Always pass the model explicitly.
> - Upstream description (replaced above to stop auto-triggering on small tasks): Use when completing tasks, implementing major features, or before merging to verify work meets requirements

# Requesting Code Review

Dispatch a code reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or: git merge-base origin/main HEAD
HEAD_SHA=$(git rev-parse HEAD)
```

**2. Dispatch code reviewer subagent:**

Dispatch a `general-purpose` subagent, filling the template at [code-reviewer.md](code-reviewer.md)

**Placeholders:**
- `{DESCRIPTION}` - Brief summary of what you built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | cut -d' ' -f1)
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch code reviewer subagent]
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types
  PLAN_OR_REQUIREMENTS: Task 2 from docs/superpowers/plans/deployment-plan.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Task 3]
```

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll just review the diff myself instead of dispatching a reviewer" | You're the coordinator — reviewing the diff inline burns the context window you need to keep driving the work. Dispatch a reviewer subagent: the diff and the evaluation live in its context, and only the findings come back to you. |
| "The reviewer needs my whole session history to understand the change" | Hand it precisely crafted context, never your session's history. That keeps the reviewer on the work product, not your thought process. |

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: [code-reviewer.md](code-reviewer.md)
