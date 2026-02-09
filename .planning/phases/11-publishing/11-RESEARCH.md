# Phase 11: Publishing - Research

**Researched:** 2026-02-09
**Domain:** npm package publishing, documentation, licensing, GitHub distribution
**Confidence:** HIGH

## Summary

Phase 11 transforms the completed MCP multi-edit server into a distributable npm package under the `@essentialai/mcp-multi-edit` scope with PolyForm Noncommercial licensing. The current codebase requires significant package.json updates (name, version, author, repository, license field, `files` allowlist, `publishConfig`), a complete README rewrite targeting Claude Code users, replacement of the MIT LICENSE with PolyForm Noncommercial 1.0.0, creation of a CHANGELOG.md, and pushing to a new GitHub repository.

The project is in good shape for publishing: the shebang (`#!/usr/bin/env node`) is already present in `src/index.ts` and correctly preserved by TypeScript compilation into `dist/index.js`, the bin entry exists, source maps are generated, and `prepublishOnly` already gates build+test. The main work is metadata correction, documentation authoring, license replacement, and distribution configuration.

**Primary recommendation:** Update package.json fields first (name, version, license, author, repository, files, publishConfig), then create LICENSE and CHANGELOG.md, then rewrite README.md, then configure git remote and push, then publish with `npm publish --access public`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- Package name: `@essentialai/mcp-multi-edit`
- Author: Pavlo Sidelov (pavlo@essentialai.uk)
- Organization: Essential AI Solutions (support@essentialai.uk)
- Repository: https://github.com/eaisdevelopment/mcp-multi-edit
- Bin entry: `mcp-multi-edit`
- Minimum Node.js: 20+ (engines field)
- PolyForm Noncommercial license (NOT MIT)
- Free for personal usage, commercial usage requires mandatory license request
- Initial version: 0.1.0
- CHANGELOG.md with initial 0.1.0 entry summarizing all features
- Manual npm publish (no CI automation)
- prepublishOnly script: `npm run build && npm test`
- Include source maps in published package
- Include TypeScript source (src/) for readability
- Use package.json `files` field (allowlist)
- Minimal package: dist/, src/, README, LICENSE, CHANGELOG only
- Exclude: tests, .planning, .idea, node_modules, config files, etc.
- Primary audience: Claude Code users
- Focus on Claude Code setup: .mcp.json config, npx usage, tool descriptions
- Detailed examples: multiple examples per tool covering basic, dry-run, replace_all, error handling, multi-file scenarios
- Standard badge set: npm version, license, build status, coverage
- Push code to GitHub repo with author "Pavlo Sidelov" <pavlo@essentialai.uk>
- Git author should be "Pavlo Sidelov" <pavlo@essentialai.uk>

### Claude's Discretion
- README section ordering and structure
- Badge service choices (shields.io etc.)
- CHANGELOG format (Keep a Changelog, etc.)
- Keywords list for npm discoverability
- package.json field ordering

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

## Standard Stack

This phase does not introduce new libraries. It configures existing project infrastructure for distribution.

### Core Tools
| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| npm | 10+ (ships with Node 20) | Package publishing | Official npm registry CLI |
| git | 2.x | Push to GitHub | Standard VCS for npm packages |
| shields.io | N/A (service) | README badges | Industry standard, used by Vue.js, Bootstrap, VS Code |

### No New Dependencies Required
All publishing work is configuration, documentation, and metadata -- no new npm packages needed.

## Architecture Patterns

### Package.json Target State

The following fields must be changed from their current values:

```json
{
  "name": "@essentialai/mcp-multi-edit",
  "version": "0.1.0",
  "description": "MCP server providing atomic multi-edit capabilities for Claude Code and Claude Desktop",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "bin": {
    "mcp-multi-edit": "dist/index.js"
  },
  "files": [
    "dist/",
    "src/",
    "LICENSE",
    "CHANGELOG.md"
  ],
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "prepublishOnly": "npm run build && npm run test"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "claude",
    "claude-code",
    "multi-edit",
    "file-editing",
    "atomic-operations",
    "find-and-replace",
    "code-editing"
  ],
  "author": "Pavlo Sidelov <pavlo@essentialai.uk>",
  "license": "PolyForm-Noncommercial-1.0.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/eaisdevelopment/mcp-multi-edit"
  },
  "bugs": {
    "url": "https://github.com/eaisdevelopment/mcp-multi-edit/issues"
  },
  "homepage": "https://github.com/eaisdevelopment/mcp-multi-edit#readme",
  "engines": {
    "node": ">=20.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

**Key changes from current state:**
| Field | Current | Target | Why |
|-------|---------|--------|-----|
| `name` | `@anthropic-community/eais-mcp-multi-edit` | `@essentialai/mcp-multi-edit` | User decision |
| `version` | `1.0.0` | `0.1.0` | User decision -- initial release |
| `author` | `Pavlo Sidelov <pavlo@sdkfinance.com>` | `Pavlo Sidelov <pavlo@essentialai.uk>` | User decision |
| `license` | `MIT` | `PolyForm-Noncommercial-1.0.0` | User decision -- NOT MIT |
| `repository.url` | `https://github.com/anthropic-community/...` | `https://github.com/eaisdevelopment/mcp-multi-edit` | User decision |
| `files` | (absent -- includes everything) | `["dist/", "src/", "LICENSE", "CHANGELOG.md"]` | User decision -- allowlist |
| `publishConfig` | (absent) | `{"access": "public"}` | Required for scoped public packages |
| `types` | (absent) | `dist/index.d.ts` | Best practice for TypeScript packages |
| `bugs` | (absent) | GitHub issues URL | npm best practice |
| `homepage` | (absent) | GitHub README URL | npm best practice |

### Server Name Update

The server currently identifies itself as `eais-mcp-multi-edit` in `src/server.ts` line 128. This should be updated to reflect the new package name. The version in `src/server.ts` line 129 is currently hardcoded as `1.0.0` and should become `0.1.0`.

### Files Field Behavior (HIGH confidence)

Source: [npm docs - package.json files](https://docs.npmjs.com/cli/v6/configuring-npm/package-json/)

- The `files` field is an allowlist of files to include in the published tarball
- Certain files are **always included** regardless of `files` setting: `package.json`, `README`, `LICENSE`/`LICENCE`, and the file in `main`
- Certain files are **always excluded**: `.git`, `node_modules`, `.DS_Store`, `*.orig`, `.npmrc`
- Since README, LICENSE, and package.json are auto-included, the `files` array only needs: `["dist/", "src/", "CHANGELOG.md"]`
- However, explicitly listing LICENSE and CHANGELOG.md is harmless and makes intent clear

### publishConfig for Scoped Packages (HIGH confidence)

Source: [npm docs - creating scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)

Scoped packages default to **private** visibility. Two ways to publish publicly:
1. `publishConfig.access: "public"` in package.json (preferred -- prevents forgetting the flag)
2. `npm publish --access public` CLI flag

Use both for safety: put `publishConfig` in package.json AND pass `--access public` on first publish.

### npm Organization Prerequisite (HIGH confidence)

Source: [npm docs - creating an organization](https://docs.npmjs.com/creating-an-organization/)

Before publishing `@essentialai/mcp-multi-edit`:
1. The npm user account must exist (the person publishing)
2. The `essentialai` npm organization must exist on npmjs.com
3. The publishing user must be a member of the organization with publish permissions
4. Organization creation is free for public packages

This is a **manual prerequisite** that cannot be automated by the planner -- it must be done via the npmjs.com web interface before `npm publish`.

### SPDX License Identifier (HIGH confidence)

Source: [SPDX License List](https://spdx.org/licenses/PolyForm-Noncommercial-1.0.0.html)

The SPDX identifier for PolyForm Noncommercial is: `PolyForm-Noncommercial-1.0.0`

This is an officially recognized SPDX identifier. npm will accept it in the `license` field without warnings.

### PolyForm Noncommercial License Text (HIGH confidence)

Source: [PolyForm Project](https://polyformproject.org/licenses/noncommercial/1.0.0/)

The full license text must replace the current MIT LICENSE file. Key sections:
- **Acceptance** -- agreement to terms
- **Copyright License** -- grants copyright license for permitted purposes
- **Distribution License** -- allows distributing copies
- **Notices** -- recipients must receive terms
- **Changes and New Works License** -- allows modifications for permitted purposes
- **Patent License** -- covers patent claims
- **Noncommercial Purposes** -- any noncommercial purpose is permitted
- **Personal Uses** -- research, experiment, testing, study, entertainment, hobby projects
- **Noncommercial Organizations** -- charitable, educational, public research, government use
- **Fair Use** -- does not limit fair use rights
- **No Other Rights** -- no sublicensing or transfer
- **Patent Defense** -- patent license ends if you claim infringement
- **Violations** -- 32-day cure period for first violation
- **No Liability** -- software provided as-is
- **Definitions** -- licensor, software, you, your company, control, use

The LICENSE file should include at the top:
```
Copyright (c) 2026 Essential AI Solutions (Pavlo Sidelov)
```

And a note about commercial licensing:
```
For commercial licensing inquiries, contact: support@essentialai.uk
```

### CHANGELOG.md Format (Claude's discretion -- recommending Keep a Changelog)

Source: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

Recommended format for the initial entry:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-09

### Added
- `multi_edit` tool: atomic find-and-replace operations on a single file
- `multi_edit_files` tool: coordinated edits across multiple files with rollback
- Dry-run mode for previewing changes without modification
- Automatic backup (.bak) file creation before edits
- Structured error responses with recovery hints
- Conflict detection for overlapping edits
- Path validation (absolute paths, symlink resolution, existence checks)
- 90%+ test coverage with unit and integration tests

[0.1.0]: https://github.com/eaisdevelopment/mcp-multi-edit/releases/tag/v0.1.0
```

Change categories from Keep a Changelog: Added, Changed, Deprecated, Removed, Fixed, Security. For initial release, only "Added" applies.

### README Structure (Claude's discretion)

Recommended section ordering for Claude Code audience:

```markdown
# @essentialai/mcp-multi-edit

[badges]

[one-line description]

## Quick Start (Claude Code)
  - .mcp.json config
  - npx usage

## Quick Start (Claude Desktop)
  - claude_desktop_config.json

## Features

## Tools
  ### multi_edit
    - Description
    - Parameters table
    - Examples (basic, dry-run, replace_all, error handling)
  ### multi_edit_files
    - Description
    - Parameters table
    - Examples (basic, multi-file rename, error/rollback)

## Error Handling

## Development

## License
```

### Badge URLs (Claude's discretion -- using shields.io)

```markdown
[![npm version](https://img.shields.io/npm/v/@essentialai/mcp-multi-edit)](https://www.npmjs.com/package/@essentialai/mcp-multi-edit)
[![license](https://img.shields.io/npm/l/@essentialai/mcp-multi-edit)](./LICENSE)
[![build status](https://img.shields.io/github/actions/workflow/status/eaisdevelopment/mcp-multi-edit/ci.yml?branch=main)](https://github.com/eaisdevelopment/mcp-multi-edit/actions)
[![coverage](https://img.shields.io/badge/coverage-90%25%2B-brightgreen)](./README.md)
```

Note: The build status badge assumes a GitHub Actions workflow exists. Since CI/CD is out of scope for this phase, the build badge may not resolve initially. The coverage badge is a static badge since there is no coverage reporting service configured.

### Claude Code .mcp.json Configuration (HIGH confidence)

Source: [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)

For the README, document two methods:

**Method 1: Project-scoped .mcp.json** (recommended for teams):
```json
{
  "mcpServers": {
    "multi-edit": {
      "command": "npx",
      "args": ["-y", "@essentialai/mcp-multi-edit"]
    }
  }
}
```

**Method 2: CLI command**:
```bash
claude mcp add --transport stdio multi-edit -- npx -y @essentialai/mcp-multi-edit
```

**Method 3: Claude Desktop config**:
```json
{
  "mcpServers": {
    "multi-edit": {
      "command": "npx",
      "args": ["-y", "@essentialai/mcp-multi-edit"]
    }
  }
}
```

The MCP server name in `.mcp.json` determines the tool prefix in Claude Code: `mcp__multi-edit__multi_edit` and `mcp__multi-edit__multi_edit_files`.

### Git Remote and Push Configuration

Current state:
- No git remote is configured (verified: `git remote -v` returns empty)
- Local git user is `Pavlo Sidelov <pavlo@sdkfinance.com>` -- needs updating to `pavlo@essentialai.uk`
- Target remote: `https://github.com/eaisdevelopment/mcp-multi-edit`

Steps:
1. Update local git config: `git config user.email "pavlo@essentialai.uk"` and `git config user.name "Pavlo Sidelov"`
2. Add remote: `git remote add origin https://github.com/eaisdevelopment/mcp-multi-edit.git`
3. Push: `git push -u origin main`

**Prerequisite:** The GitHub repository `eaisdevelopment/mcp-multi-edit` must exist. The user must either:
- Create it manually on github.com, OR
- Use `gh repo create eaisdevelopment/mcp-multi-edit --public` (requires GitHub CLI authentication)

### Keywords for npm Discoverability (Claude's discretion)

Recommended keywords: `mcp`, `model-context-protocol`, `claude`, `claude-code`, `multi-edit`, `file-editing`, `atomic-operations`, `find-and-replace`, `code-editing`

These target:
- Users searching for MCP servers
- Users searching for Claude Code tools
- Users searching for file editing utilities

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| License text | Writing your own license text | PolyForm Noncommercial 1.0.0 verbatim from polyformproject.org | Legal precision matters; use the canonical text exactly |
| Badge images | Generating badge SVGs | shields.io service URLs | Automatic updates, CDN-hosted, industry standard |
| CHANGELOG format | Custom changelog format | Keep a Changelog convention | Widely recognized, parseable, follows semver |
| Package contents control | .npmignore (denylist) | `files` field in package.json (allowlist) | Allowlist is safer; denylist risks accidentally including sensitive files |

## Common Pitfalls

### Pitfall 1: Forgetting --access public for Scoped Packages
**What goes wrong:** `npm publish` defaults scoped packages to private, returning `402 Payment Required` or access error.
**Why it happens:** npm treats all `@scope/name` packages as private by default.
**How to avoid:** Add `publishConfig.access: "public"` to package.json AND pass `--access public` on first publish.
**Warning signs:** Error message mentioning "payment" or "private package" during publish.

### Pitfall 2: npm Organization Does Not Exist
**What goes wrong:** `npm publish` fails with `404 Not Found` or scope error.
**Why it happens:** The `@essentialai` scope must correspond to an npm organization or user account.
**How to avoid:** Create the `essentialai` organization on npmjs.com BEFORE attempting to publish.
**Warning signs:** Any 404 error during `npm publish`.

### Pitfall 3: Files Field Excludes Required Files
**What goes wrong:** Package installs but fails to run because compiled files are missing.
**Why it happens:** Adding `files` field without including `dist/`.
**How to avoid:** Always run `npm pack --dry-run` to verify tarball contents before publishing.
**Warning signs:** `npm pack --dry-run` output does not show `dist/` files.

### Pitfall 4: Missing Shebang in Bin Entry
**What goes wrong:** `npx @essentialai/mcp-multi-edit` fails with permission or exec errors.
**Why it happens:** The compiled JavaScript file referenced by `bin` lacks `#!/usr/bin/env node`.
**How to avoid:** Verify the shebang is in `src/index.ts` (line 1) -- TypeScript preserves it in output.
**Warning signs:** Already verified -- shebang IS present in both source and compiled output. No action needed.

### Pitfall 5: Version Mismatch Between package.json and server.ts
**What goes wrong:** The MCP server reports version `1.0.0` while the npm package is `0.1.0`.
**Why it happens:** The server version in `src/server.ts` line 129 is hardcoded as `'1.0.0'`.
**How to avoid:** Update `src/server.ts` to match `package.json` version `0.1.0`.
**Warning signs:** MCP server handshake reports wrong version.

### Pitfall 6: Git Author Mismatch
**What goes wrong:** Commits appear with wrong author email (`pavlo@sdkfinance.com`).
**Why it happens:** Local git config has the old email.
**How to avoid:** Update git config BEFORE making any new commits for this phase.
**Warning signs:** `git config user.email` shows `sdkfinance.com` instead of `essentialai.uk`.

### Pitfall 7: Publishing Without Building First
**What goes wrong:** Published package contains stale compiled files.
**Why it happens:** Developer runs `npm publish` without fresh build.
**How to avoid:** The `prepublishOnly` script (`npm run build && npm run test`) already handles this. Do not remove it.
**Warning signs:** None -- already mitigated by existing `prepublishOnly` hook.

### Pitfall 8: GitHub Repository Does Not Exist Before Push
**What goes wrong:** `git push` fails with `repository not found`.
**Why it happens:** Remote repository must be created on GitHub before pushing.
**How to avoid:** Create `eaisdevelopment/mcp-multi-edit` repository on GitHub (or via `gh repo create`) before `git push`.
**Warning signs:** Any error during `git remote add` or `git push`.

## Code Examples

### Verified: npm pack dry-run (test before publish)
```bash
# Verify exactly what files will be in the published package
npm pack --dry-run
```

Current output (WITHOUT files field) shows 100+ files including .planning/, .idea/, etc. After adding the `files` field, output should show only:
- `dist/**` (compiled JS, declaration files, source maps)
- `src/**` (TypeScript source)
- `LICENSE`
- `CHANGELOG.md`
- `README.md` (auto-included)
- `package.json` (auto-included)

### Verified: Publishing command
```bash
# First-time publish for scoped package
npm publish --access public
```

### Verified: Claude Code .mcp.json setup
```json
{
  "mcpServers": {
    "multi-edit": {
      "command": "npx",
      "args": ["-y", "@essentialai/mcp-multi-edit"]
    }
  }
}
```

### Verified: Claude Code CLI setup
```bash
claude mcp add --transport stdio multi-edit -- npx -y @essentialai/mcp-multi-edit
```

### Verified: Git remote setup
```bash
git config user.name "Pavlo Sidelov"
git config user.email "pavlo@essentialai.uk"
git remote add origin https://github.com/eaisdevelopment/mcp-multi-edit.git
git push -u origin main
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.npmignore` (denylist) | `files` field (allowlist) | Long-standing best practice | Prevents accidental secret/config leaks |
| `npm publish --access public` only | `publishConfig.access` in package.json | npm 6+ | Prevents forgetting the flag |
| Claude Desktop only config | `.mcp.json` + `claude mcp add` CLI | 2025-2026 | Claude Code has its own config format |
| SSE transport for MCP | HTTP transport (recommended) | 2025-2026 | SSE deprecated; stdio still standard for local servers |

**Deprecated/outdated:**
- The current `README.md` references `@anthropic-community/eais-mcp-multi-edit` -- must be fully replaced
- The current `LICENSE` is MIT -- must be replaced with PolyForm Noncommercial 1.0.0
- The `.mcp.json` in the project root uses `"command": "node", "args": ["dist/index.js"]` for local dev -- this is fine but README should show the npx pattern for end users

## Open Questions

1. **npm Organization Creation**
   - What we know: The `@essentialai` npm scope requires an organization to exist on npmjs.com
   - What's unclear: Whether the `essentialai` organization already exists on npm
   - Recommendation: Plan should include a prerequisite check/creation step and document it clearly as a manual step the user must perform before publish

2. **GitHub Repository Creation**
   - What we know: The target is `https://github.com/eaisdevelopment/mcp-multi-edit`
   - What's unclear: Whether the GitHub organization `eaisdevelopment` and repository already exist
   - Recommendation: Plan should include a prerequisite step to create the repo (manual or via `gh repo create`)

3. **npm Authentication**
   - What we know: Current system is NOT logged into npm (`npm whoami` returns ENEEDAUTH)
   - What's unclear: Which npm account will be used to publish
   - Recommendation: Plan should include `npm login` as a prerequisite step

4. **Build Status Badge**
   - What we know: CI/CD is out of scope for this phase
   - What's unclear: Whether a GitHub Actions workflow will exist to make the build badge resolve
   - Recommendation: Include the badge URL in README but note it may show "not found" until CI is configured. Alternatively, use a static badge or omit until CI exists.

## Sources

### Primary (HIGH confidence)
- [npm docs - package.json files field](https://docs.npmjs.com/cli/v6/configuring-npm/package-json/) -- files allowlist behavior, auto-included files
- [npm docs - creating scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/) -- publishConfig, --access public
- [npm docs - creating an organization](https://docs.npmjs.com/creating-an-organization/) -- org prerequisite for scoped packages
- [SPDX License List - PolyForm-Noncommercial-1.0.0](https://spdx.org/licenses/PolyForm-Noncommercial-1.0.0.html) -- official SPDX identifier
- [PolyForm Project - Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/) -- full license text
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp) -- .mcp.json format, scopes, CLI commands
- [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) -- changelog format convention
- [Shields.io](https://shields.io/) -- badge service
- Local project inspection -- package.json, tsconfig.json, src/index.ts, dist/index.js, git config, npm whoami

### Secondary (MEDIUM confidence)
- [npm docs - npm-publish](https://docs.npmjs.com/cli/v8/commands/npm-publish/) -- publish command options
- [GitHub docs - adding locally hosted code](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github) -- git remote add + push workflow

### Tertiary (LOW confidence)
- None -- all claims verified against primary sources

## Metadata

**Confidence breakdown:**
- Package.json configuration: HIGH -- verified against npm docs and local project state
- License (PolyForm Noncommercial): HIGH -- SPDX identifier confirmed, full text fetched from official source
- npm publishing workflow: HIGH -- verified against npm docs; prerequisites (org, auth) clearly documented
- README content/structure: HIGH -- Claude Code config format verified from official docs
- Git/GitHub setup: HIGH -- verified current state (no remote, wrong email) and documented correction steps
- Badge URLs: MEDIUM -- shields.io URLs follow standard pattern but build badge depends on CI that doesn't exist yet

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days -- npm publishing workflow is stable)
