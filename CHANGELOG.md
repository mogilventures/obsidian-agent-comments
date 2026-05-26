# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- MVP plugin scaffold: thread types, mention parser, provider router, patch applicator, thread lifecycle, thread store, sidebar view, settings tab, and main plugin entry point.
- Hermes provider with file-based bridge (`pending/` → `complete/` queue).
- Claude Code provider stub (local CLI invocation, read-only, suggestions only).
- Codex provider stub (local CLI invocation, requires git working directory).
- CodeMirror 6 highlight decorations for commented text ranges.
- Right-sidebar thread panel with per-thread status, messages, and apply/reject controls.
- Explicit consent prompt before any note content is sent to a provider.
- Unit tests for mention parser and provider router (Jest + ts-jest).
- CI workflow: `npm ci`, `npm test`, `npm run build`.
- Release workflow: builds and uploads `main.js`, `manifest.json`, `styles.css` on version tags.
- Public repo docs: README, LICENSE (MIT), SECURITY.md, CONTRIBUTING.md, CODE_OF_CONDUCT.md, CODEOWNERS, docs/provider-contract.md, docs/security-model.md, docs/roadmap.md.
