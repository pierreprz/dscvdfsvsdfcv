# CLAUDE.md

This file provides guidance for AI assistants (Claude Code and similar tools) working in this repository.

## Repository Overview

- **Name**: dscvdfsvsdfcv
- **Remote**: `pierreprz/dscvdfsvsdfcv` on GitHub
- **State**: Newly initialized — only a `README.md` exists as of the initial commit.
- **Primary branch**: `main`

No language, framework, or toolchain has been committed yet. When a stack is chosen, update this file to reflect the actual structure, commands, and conventions.

## Branch Workflow

- Development feature branches follow the pattern `claude/<description>-<ID>` (e.g. `claude/add-claude-documentation-9G8QT`).
- **Never push directly to `main`** without explicit user approval.
- Always push to the designated feature branch and open a PR only when the user explicitly requests it.

## Git Conventions

- Write commit messages in imperative mood, present tense: `Add feature`, not `Added feature`.
- Keep the subject line under 72 characters.
- Reference issues or tasks in the body when relevant.
- Stage specific files by name; avoid `git add -A` or `git add .` to prevent accidentally committing secrets or binaries.
- Never skip hooks (`--no-verify`) or bypass signing without explicit user instruction.

## File & Code Conventions

Until a language/framework is committed, these are the defaults to apply when writing new code:

- **Comments**: Write no comments unless the *why* is non-obvious (hidden constraint, workaround, subtle invariant). Never describe *what* the code does.
- **Naming**: Prefer descriptive, self-documenting identifiers over abbreviations.
- **No premature abstractions**: Three similar lines are better than a speculative helper. Add abstractions only when a pattern repeats three or more times with identical intent.
- **Error handling**: Only validate at system boundaries (user input, external APIs). Do not add defensive checks for conditions that cannot occur in internal code.
- **No dead code**: Remove unused variables, functions, and imports rather than commenting them out.
- **No backwards-compatibility stubs**: If something is unused, delete it.

## Security

- Never commit secrets, credentials, API keys, or `.env` files.
- Validate and sanitize all user-supplied input at the boundary.
- Avoid constructing shell commands from user data (command injection risk).
- Review any new dependency for known vulnerabilities before adding it.

## Working with GitHub

- Use GitHub MCP tools (`mcp__github__*`) for all GitHub interactions; do not assume the `gh` CLI is available in remote execution environments.
- Do **not** create a pull request unless the user explicitly asks for one.
- Do **not** post comments on issues or PRs unless a reply is genuinely necessary.
- The only repository in scope for MCP tool calls is `pierreprz/dscvdfsvsdfcv`.

## Updating This File

When the project stack is established, update this file to include:

1. **Project structure** — directory layout with a one-line description of each major directory.
2. **Setup** — exact commands to install dependencies and configure the environment.
3. **Development server** — how to run the app locally.
4. **Testing** — how to run the test suite and what the coverage targets are.
5. **Linting / formatting** — tools used and how to run them.
6. **Build / deploy** — how to produce a production artifact and where it goes.
7. **Environment variables** — required variables, their purpose, and where to obtain them (never the values themselves).
8. **Architecture decisions** — any non-obvious design choices that future contributors need to know.
