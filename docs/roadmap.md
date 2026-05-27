# Roadmap

## MVP — v0.1.x (current)

- [x] Thread data model and JSON persistence (sidecar files).
- [x] Mention parser (`@Hermes`, `@Steve`, `@Claude`, `@Codex`).
- [x] Provider router with `AgentProvider` interface.
- [x] Patch applicator (explicit accept/reject, `replace` type only).
- [x] Thread lifecycle state machine.
- [x] Thread store (CRUD, sidecar JSON).
- [x] Sidebar thread panel (right leaf).
- [x] Settings tab with per-provider enable/disable and bridge path.
- [x] Hermes provider — file-based bridge (`pending/` → `complete/`).
- [x] Claude Code provider stub (local CLI, print mode, read-only).
- [x] Codex provider stub (local CLI, requires git workdir).
- [x] CodeMirror 6 decorations for highlighted comment ranges.
- [x] Consent prompt on first use.
- [x] Unit tests for mention parser and provider router.
- [ ] CI workflow (test + build on every push) — deferred from PR #1 because current GitHub OAuth lacks `workflow` scope.
- [ ] Release workflow (artifacts on version tags) — deferred from PR #1 because current GitHub OAuth lacks `workflow` scope.
- [x] Public repo hygiene: MIT license, SECURITY, CONTRIBUTING, CHANGELOG, CODE_OF_CONDUCT, CODEOWNERS.
- [x] Provider contract and security model docs.

## Near-term — v0.2.x

- [x] Selection-first comment UX: add **Add Agent Comment** to the right-click context menu when text is selected in Live Preview/source mode.
- [x] Reading View comment UX: support selecting rendered text and adding a comment without using the command palette; uses quote-based anchoring with an ambiguity fallback when rendered text cannot be mapped cleanly to Markdown source offsets.
- [ ] Hermes provider: poll-on-interval rather than manual refresh; configurable poll delay.
- [ ] Anchor re-anchoring: exact quote search near previous offset on file open.
- [ ] `lost_anchor` indicator and manual reattach command.
- [ ] Follow-up message in thread (add reply without reopening anchor selection).
- [ ] Thread resolve/reopen commands.
- [ ] Better diff display: side-by-side or inline highlighted diff.

## Medium-term — v0.3.x

- [ ] Claude Code provider: full working invocation with structured JSON output parsing.
- [ ] Codex provider: full working invocation.
- [ ] Fuzzy re-anchoring (normalized whitespace, prefix/suffix context fallback).
- [ ] Localhost HTTP bridge for Hermes (127.0.0.1 only, bearer token auth).
- [ ] OS keychain integration for localhost bearer token.
- [ ] Obsidian community plugin directory submission.

## Later / stretch

- [ ] Reading View comment rendering (separate `MarkdownPostProcessor`).
- [ ] True inline thread widgets embedded in text flow.
- [ ] Multi-file patches.
- [ ] Mobile support (requires reassessing file bridge and CLI invocation model).
- [ ] Companion bridge CLI package for Hermes runner distribution.
- [ ] Citation / research summary rendering in sidebar.
- [ ] Thread export (copy thread as Markdown).
