# Phase 11: Publishing - Context

**Gathered:** 2026-02-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Prepare and publish the package to npm public registry. Includes README documentation, package metadata, license, changelog, and distribution configuration. Does not include CI/CD automation, website, or post-publish marketing.

</domain>

<decisions>
## Implementation Decisions

### README & Documentation
- Primary audience: Claude Code users
- Focus on Claude Code setup: .mcp.json config, npx usage, tool descriptions
- Detailed examples: multiple examples per tool covering basic, dry-run, replace_all, error handling, multi-file scenarios
- Standard badge set: npm version, license, build status, coverage

### Package Identity & Metadata
- Package name: `@essentialai/mcp-multi-edit`
- Author: Pavlo Sidelov (pavlo@essentialai.uk)
- Organization: Essential AI Solutions (support@essentialai.uk)
- Repository: https://github.com/eaisdevelopment/mcp-multi-edit
- Bin entry: `mcp-multi-edit`
- Minimum Node.js: 20+ (engines field)
- Push code to GitHub repo with author "Pavlo Sidelov" <pavlo@essentialai.uk>

### License
- PolyForm Noncommercial license
- Free for personal usage
- Commercial usage requires mandatory license request
- NOT MIT (roadmap originally said MIT — overridden by user decision)

### Release Process
- Initial version: 0.1.0
- CHANGELOG.md with initial 0.1.0 entry summarizing all features
- Manual npm publish (no CI automation)
- prepublishOnly script: `npm run build && npm test` (automated gate before publish)

### Distribution Scope
- Include source maps in published package
- Include TypeScript source (src/) for readability
- Use package.json `files` field (allowlist) — explicit, predictable
- Minimal package: dist/, src/, README, LICENSE, CHANGELOG only
- Exclude: tests, .planning, .idea, node_modules, config files, etc.

### Claude's Discretion
- README section ordering and structure
- Badge service choices (shields.io etc.)
- CHANGELOG format (Keep a Changelog, etc.)
- Keywords list for npm discoverability
- package.json field ordering

</decisions>

<specifics>
## Specific Ideas

- Author wants code pushed to https://github.com/eaisdevelopment/mcp-multi-edit with full project code
- Git author should be "Pavlo Sidelov" <pavlo@essentialai.uk>
- Organization branding: "Essential AI Solutions" with support@essentialai.uk contact

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-publishing*
*Context gathered: 2026-02-09*
