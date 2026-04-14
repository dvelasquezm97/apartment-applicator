# Aucto Operating System

This product is part of **Aucto**, an agentic-first company.

Full documentation: [`~/Desktop/aucto/docs/HOW-IT-WORKS.md`](../../aucto/docs/HOW-IT-WORKS.md)

## Quick Reference

- **Company OS repo:** `~/Desktop/aucto/`
- **Skills:** Symlinked from `~/Desktop/aucto/skills/` → `~/.claude/commands/`
- **Codex hook:** Symlinked from `~/Desktop/aucto/hooks/` → `.git/hooks/pre-commit`
- **Global context:** Symlinked from `~/Desktop/aucto/claude-global.md` → `~/.claude/CLAUDE.md`
- **Paperclip:** `http://localhost:3100` (this product = BerlinKeys company, prefix BER-)
- **claude-mem:** `http://localhost:37777`

## Edit OS from here?
Yes — editing any skill or the global CLAUDE.md from this repo edits the Aucto source (symlinks). Run `/sync-os` to push changes to GitHub.
