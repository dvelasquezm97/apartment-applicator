# Agent Communication Protocol — BerlinKeys

## Directory Structure

```
.agents/
  briefs/      ← Project briefs from /ideate, COO challenges, CTO plans
  reviews/     ← Codex pre-commit reports, arch reviews, QA reports, compliance audits
  designs/     ← Design specs (when /design-* skills produce artifacts)
  decisions/   ← Architectural decision records
  config.json  ← Agent system configuration
  README.md    ← This file
```

## Agents

| Agent | Process | Model | Role |
|-------|---------|-------|------|
| Claude Code | Claude Code CLI | Opus 4.6 | CTO, orchestrator, all specialist roles |
| Codex CLI | Separate process | OpenAI | Independent code reviewer |

## Pipeline

```
/ideate → /think-like-a-COO → /cto-plan → [agents] → /ship → /safe-deploy
```

## File Naming Convention

All files use: `YYYY-MM-DD-HHMMSS-{agent}-{type}-{project-slug}.md`

Examples:
- `2026-04-14-143022-ideate-m1-session.md`
- `2026-04-14-160000-coo-challenge-m1-session.md`
- `2026-04-14-170000-cto-plan-m1-session.md`
- `2026-04-14-180000-codex-precommit.md`

## Codex Pre-Commit Hook

Every `git commit` triggers automatic Codex review. Reports saved to `reviews/`.
Bypass: `SKIP_CODEX_REVIEW=1 git commit -m "..."`
