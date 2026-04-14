# Project Brief: Aucto

**Date:** 2026-04-14
**Status:** IDEATION

## Problem Statement
Building and managing multiple AI-driven products requires a company structure that is itself agentic — not just a human using AI tools, but an actual company where agents are the team. Today, agent infrastructure is ad-hoc and product-scoped. There's no unified agentic company that develops itself in parallel with the products it ships.

## Users
Two types:
1. **David (founder)** — Solves his own problems first (dogfooding). Uses Aucto to ideate, build, ship, and manage products. Oversees agent team, approves at gates.
2. **External users** — People who share the same problems David solves. Some products start as personal tools, then open to others. Some are built for external users from day one.

## Scope
**Both infrastructure AND production.** Aucto is:
- A company that gets developed (its own agents, features, roadmap, processes)
- A platform that spawns and manages product companies (BerlinKeys, future ideas)
- Each product company also has agents and goes through the full pipeline

## Solution Overview
Aucto is an agentic-first company with two layers:

**Layer 1: The Company (Aucto itself)**
- Agent team: Claude (CTO/builder), Codex (reviewer), gstack skills as specialist agents
- Company operations: ideation pipeline (/ideate → /think-like-a-COO → /cto-plan), project management (Paperclip), knowledge management (claude-mem, Obsidian, docs)
- Company development: Aucto's own processes, tools, and infrastructure evolve as a product

**Layer 2: The Products (managed by Aucto)**
- Each product idea goes through the full agent pipeline
- Each product is a project in Paperclip with its own goals, tasks, agent assignments
- Products can have their own agents, codebases, and infrastructure
- First product: BerlinKeys (automated apartment applications for Immoscout24)

## Done State (MVP)
Aucto is "real" when:
1. The agent team can take a product idea from ideation to shipped MVP using the pipeline
2. At least one product (BerlinKeys) is live and solving David's problem
3. The company infrastructure (Paperclip, skills, memory, docs) works across multiple products
4. New product ideas can be spun up without rebuilding infrastructure

## Success Metric
- BerlinKeys MVP is live and automating apartment applications
- A second product idea can be created, planned, and started using the same agent team
- Revenue from at least one product (stretch goal for MVP phase)

## Integrations
- Paperclip (agent orchestration, project management)
- claude-mem (session memory across products)
- gstack (23 specialist skills)
- Codex CLI (code review)
- Obsidian (documentation browsing)
- Per-product: each product has its own tech stack (BerlinKeys: Supabase, Redis, Playwright, etc.)

## Risks
- **Over-engineering the company before shipping a product** — Aucto infrastructure is only valuable if it produces working products
- **Agent coordination complexity** — managing agents across multiple products simultaneously
- **Context switching** — agent team working on Aucto infrastructure vs product development
- **Revenue timeline** — products need to actually solve problems and reach users

## Constraints
- David is the sole human operator (agents do the work, David approves)
- Must use existing agent stack (Claude Code, Codex CLI, gstack)
- Products must solve real problems David has (dogfooding first)
- No external funding — revenue from products funds the company

## Out of Scope (for now)
- Hiring human employees
- External agent marketplace (selling agent services)
- Multi-human collaboration features
- Public company website/branding

## Open Questions for /think-like-a-COO
1. Should Aucto infrastructure development be its own project in Paperclip, or is it implicit overhead?
2. How do we prevent the company-building from consuming all time vs actually shipping products?
3. What's the right ratio of "improve the company" vs "ship products" work?
4. Should each product have its own repo/codebase, or monorepo under Aucto?
