<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# CPoint-PMS: rules for every agent (Codex reads this file)

## Roles

- **Claude** is the main software developer: plans, builds features, writes the docs, writes QA
  handoffs and Codex prompts.
- **Codex** does two jobs, each started by a prompt Dylan pastes:
  1. **QA runs:** browser and e2e tests from a handoff in `qa/handoffs/`, reported in
     `qa/reports/`. Test only; no code changes.
  2. **CI fixes:** when a GitHub CI check fails on a PR, Claude writes
     `qa/CODEX_PROMPT_CI_FIX_<branch>.md` and Codex applies the fix (D-089). Change only what
     makes the failing checks pass; never skip, disable or loosen a test or a check.
- Neither agent creates branches, commits, pushes or PRs. Dylan does.

## Vault first

Dylan's Obsidian vault at `C:\dev\capstone-obsidian` is the first place to look things up. Before
exploring the repo, read its `CLAUDE.md`, `Rules.md`, `Home.md` and
`Inbox/CPoint commands and where to look.md`, and the phase summary in `Notes/Phases/` for the
work at hand. They say which single repo file answers each question, so you don't read the whole
project or guess. The repo wins when the two disagree.

Read and write repo files through `C:\dev\CPoint-PMS`, never through the vault's `CPoint-PMS/`
junctions.

## Record every change

Every change, including a Codex CI fix, is written down in both places:

- **Repo:** a report in `qa/reports/` (Codex) or the wrap-up docs (Claude: STATUS, SESSION_LOG,
  DECISIONS, ROADMAP).
- **Vault:** one line in today's `Daily/YYYY-MM-DD.md` under "Agent sessions", linking the
  prompt and report as `[[CPoint-PMS/qa/…]]`. Claude also keeps the phase summary note current.

## Project rules

`CLAUDE.md` holds the project rules (MVC layering, guards, `runInTransaction` + `recordAudit`,
defect types as data, Docker with two services). They apply to Codex's fixes too.
