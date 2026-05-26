---
title: Obsidian Agent Comments Plugin Plan
created: 2026-05-26T07:05:14+01:00
status: planning
owner: Mogil Ventures
repo_candidate: mogilventures/obsidian-agent-comments
---

# Obsidian Agent Comments Plugin Plan

## One-line concept

A public Mogil Ventures Obsidian desktop plugin that adds AI-assisted comment threads to Markdown notes: select text, add a comment, tag `@Steve`, `@Hermes`, `@Claude`, or `@Codex`, receive a threaded reply plus a suggested patch, then accept/reject/resolve inside Obsidian.

## Public repo intent

Target home:

- GitHub org: `mogilventures`
- Recommended repo name: `obsidian-agent-comments`
- Alternative names:
  - `obsidian-steve-comments`
  - `obsidian-ai-review-comments`
  - `obsidian-agent-threads`

Positioning:

> Inline AI-assisted review comments for Obsidian. Bring GitHub PR-style comments and agent-generated suggestions to Markdown notes.

This should be generic enough for public users while still supporting Noah's Steve/Hermes workflow.

## Core principle

Do **not** make the plugin Hermes-only.

Model the assistant side as a provider/adapter interface:

```ts
interface AgentProvider {
  id: string;
  displayName: string;
  canHandleMention(mention: string): boolean;
  submitThread(thread: AgentThread): Promise<AgentSubmissionResult>;
  pollThread?(threadId: string): Promise<AgentThreadUpdate | null>;
}
```

Initial providers:

1. **Hermes provider**
   - File queue first.
   - Later localhost HTTP/webhook bridge.
   - Best for Steve workflow, subagents, Todoist/Obsidian context, and richer tool use.

2. **Claude Code provider**
   - Local CLI invocation.
   - Good for code/design review, repo-aware changes, and structured implementation suggestions.
   - Should run only against explicitly allowed vault paths / selected note context.

3. **Codex provider**
   - Local CLI invocation.
   - Good for code-focused notes, implementation planning, refactoring suggestions, and review comments.
   - Codex requires a git repository, so the provider may need a configured working repo or a plugin-created temporary git workspace for scratch requests.

## Desired user flow

1. User selects text in Obsidian.
2. User runs command: **Add Agent Comment**.
3. Plugin creates a comment thread anchored to selected text.
4. User types:

```text
@Steve research this claim and suggest a tighter paragraph.
```

or:

```text
@Claude critique this plugin architecture.
```

or:

```text
@Codex turn this implementation note into actionable TypeScript tasks.
```

5. Plugin detects mention and routes to configured provider.
6. Provider writes back:
   - thread reply,
   - optional suggested patch,
   - optional research summary / citations,
   - status metadata.
7. User reviews old/new diff.
8. User clicks **Apply**, **Reject**, **Ask follow-up**, or **Resolve**.

## MVP scope

Be ruthless. MVP should prove the review-comment loop, not recreate Google Docs.

### In MVP

- Desktop Obsidian only.
- Live Preview / editor mode only.
- CodeMirror 6 highlight decorations for commented ranges.
- Right sidebar thread panel.
- Sidecar JSON thread storage.
- `@Steve`, `@Hermes`, `@Claude`, `@Codex` mention parsing.
- Provider interface with at least one working provider; ideally Hermes first, with CLI-provider stubs for Claude Code and Codex.
- Single-file, selected-text comments.
- Single custom patch format:

```json
{
  "type": "replace",
  "anchorId": "anchor_123",
  "oldText": "Original paragraph",
  "newText": "Rewritten paragraph"
}
```

- Explicit accept/reject before applying edits.
- Basic audit trail in the thread JSON.
- README, LICENSE, SECURITY.md, CONTRIBUTING.md.

### Out of MVP

- Mobile support.
- Full Reading View comment rendering.
- True inline thread widgets embedded in text flow.
- Realtime localhost HTTP bridge.
- Multi-file patches.
- Multi-user collaboration.
- OS keychain integration.
- Perfect fuzzy re-anchoring.
- Direct silent auto-apply.

## Storage design

Use plugin-standard storage, not a new root dotfolder.

Recommended:

```text
.obsidian/plugins/obsidian-agent-comments/
  data.json
  threads/
    thread_<id>.json
  queue/
    pending/
    processing/
    complete/
```

However, Claude Code recommended avoiding separated `requests/`, `responses/`, and `patches/` directories as the primary state model. Better: each `thread_<id>.json` is the durable state object with a status field.

Example thread object:

```json
{
  "id": "thread_123",
  "schemaVersion": 1,
  "status": "pending",
  "file": "Writing/Draft.md",
  "createdAt": "2026-05-26T07:05:14+01:00",
  "updatedAt": "2026-05-26T07:05:14+01:00",
  "anchor": {
    "quote": "selected text",
    "prefix": "text before",
    "suffix": "text after",
    "startOffset": 1024,
    "endOffset": 1102,
    "headingPath": ["Section"],
    "blockId": null
  },
  "messages": [
    {
      "id": "msg_1",
      "author": "user",
      "body": "@Steve tighten this argument",
      "createdAt": "2026-05-26T07:05:14+01:00"
    }
  ],
  "mentions": ["Steve"],
  "provider": "hermes",
  "suggestedPatch": null,
  "audit": []
}
```

Thread statuses:

```text
open
pending
processing
responded
accepted
rejected
resolved
lost_anchor
error
```

## Anchor model

Do not rely only on offsets.

Store:

- selected quote,
- prefix context,
- suffix context,
- start/end offsets,
- heading path as a hint,
- optional Obsidian block ID,
- file path,
- content hash at request time.

Re-anchoring strategy:

1. If editor is open, map decorations through CodeMirror transactions using `RangeSet.map(transaction.changes)`.
2. On file open, try exact quote near previous offset.
3. If not found, try normalized whitespace match.
4. If not found, try quote plus prefix/suffix context.
5. If not found, mark `lost_anchor` and require manual reattach or resolve.

MVP may only implement steps 1-2 and visibly mark lost anchors.

## Obsidian / CodeMirror implementation notes

Important gotchas from Claude Code review:

- CodeMirror decorations only cover editor/live-preview mode.
- Reading View requires a separate `MarkdownPostProcessor` implementation.
- Decoration ranges must live in a CodeMirror `StateField` and be mapped on every transaction.
- Inline widgets are harder than line-end markers or sidebar state; defer true inline widgets.
- Access to Obsidian's underlying CodeMirror internals can be unofficial and brittle. Pin a `minAppVersion` and add a load-time compatibility check.

Useful APIs/classes to study:

- `Plugin`
- `MarkdownView`
- `Editor`
- `TFile`
- `Vault`
- `app.vault.process(file, fn)`
- `registerEditorExtension`
- `registerMarkdownPostProcessor`
- CodeMirror `StateField`
- CodeMirror `Decoration`
- CodeMirror `DecorationSet`
- CodeMirror `WidgetType`
- CodeMirror `RangeSet`

## Agent providers

### 1. Hermes provider

Primary provider for Noah/Steve workflow.

Transport options:

- MVP: file-backed thread updates.
- Later: localhost HTTP bridge bound to `127.0.0.1` with bearer token.
- Later: MCP/custom protocol if this becomes a general local-agent integration layer.

Strengths:

- Best for multi-tool workflows.
- Can use subagents for research.
- Can read Obsidian context under controlled scope.
- Can create Todoist tasks, update notes, search sessions, etc.

Default mode:

- `suggest_patch`, not auto-apply.

### 2. Claude Code provider

Claude Code can be supported as a local CLI provider.

Possible flow:

1. Plugin writes a provider request file with selected text and context.
2. Provider runner invokes Claude Code in print mode:

```bash
claude -p "Review this Obsidian comment thread and return JSON with reply and optional replace patch" --allowedTools "" --model sonnet
```

3. For repo-aware work, run Claude Code from a configured Git workdir and allow `Read` only, or carefully scoped tools.
4. Parse structured JSON output into the thread object.

Recommended safety:

- Start with read-only Claude Code usage for comment replies/suggestions.
- Do not let Claude Code directly edit the vault in MVP.
- Plugin applies accepted patches instead.
- Keep provider prompts explicit that note content is untrusted data.

### 3. Codex provider

Codex can also be supported as a local CLI provider.

Important gotcha:

- Codex requires a git repository.

Options:

1. User configures a working repo path for Codex-backed requests.
2. Plugin maintains a temporary git workspace for selected-note context.
3. Codex provider is limited to repos / code notes rather than arbitrary vault notes.

Possible invocation:

```bash
codex exec "Review this Obsidian comment thread and return a reply plus optional replace patch"
```

Provider should:

- use stdin/request file rather than shell-interpolating note text,
- set timeouts,
- avoid `--yolo` by default,
- avoid direct vault edits in MVP,
- return structured JSON for the plugin to display.

## Provider output contract

All providers should return the same shape:

```json
{
  "threadId": "thread_123",
  "status": "responded",
  "message": {
    "author": "agent:hermes",
    "body": "Suggested rewrite below...",
    "createdAt": "..."
  },
  "suggestedPatch": {
    "type": "replace",
    "anchorId": "anchor_123",
    "oldText": "Original paragraph",
    "newText": "Improved paragraph"
  },
  "metadata": {
    "provider": "hermes",
    "model": "...",
    "durationMs": 12345
  }
}
```

## Security requirements

Because this is public and vault contents are sensitive, security must be part of v0.

Required:

- `SECURITY.md` with responsible disclosure.
- First-use consent prompt before any note content leaves Obsidian or is sent to a provider.
- README disclosure that vault content may be sent to local/remote AI systems depending on provider.
- Provider-level enabled/disabled toggles.
- Default action level: `suggest_patch`.
- No silent auto-apply in MVP.
- Always show old/new diff before applying.
- Treat note content as untrusted input in all provider prompts.
- Never concatenate raw note text into shell commands.
- Pass request content via file/stdin/JSON payload.
- Local HTTP, when added, must bind only to `127.0.0.1`/`::1` and require auth token.
- Plugin settings are plaintext in `.obsidian/plugins/.../data.json`; avoid storing API keys there unless clearly disclosed. Prefer external CLIs' own auth stores for Claude Code/Codex/Hermes.

## Public repo requirements

Recommended files from day one:

```text
README.md
LICENSE
SECURITY.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
CODEOWNERS
CHANGELOG.md
manifest.json
package.json
tsconfig.json
.eslintrc / eslint config
src/
styles.css
docs/
  architecture.md
  provider-contract.md
  security-model.md
  roadmap.md
.github/
  workflows/build.yml
  workflows/release.yml
```

Recommended license:

- MIT.

Rationale:

- Obsidian community norm.
- Maximizes adoption.
- Keeps plugin open even if Mogil later offers a paid hosted provider or managed bridge.

Distribution notes:

- Launch via GitHub first.
- Obsidian community plugin review can take weeks.
- GitHub Releases need built artifacts:
  - `main.js`
  - `manifest.json`
  - `styles.css`
- Use `release-please` or `semantic-release`.
- Set conservative `minAppVersion` in `manifest.json`.
- Add branch protection and CODEOWNERS before accepting outside PRs.

## Helpful reference: Hover Editor

Noah flagged this repo:

- https://github.com/nothingislost/obsidian-hover-editor

Why it is relevant:

- It is a TypeScript Obsidian plugin.
- It transforms Obsidian Page Preview hover into a working editor instance.
- It likely contains useful patterns for editor-in-popover / hover UX, Obsidian workspace integration, and managing embedded editor instances.
- It is MIT licensed.
- As of lookup on 2026-05-26, GitHub metadata showed:
  - repo: `nothingislost/obsidian-hover-editor`
  - description: "Transform the Page Preview hover into a working editor instance"
  - language: TypeScript
  - stars: 754
  - forks: 35
  - default branch: `master`
  - license: MIT
  - updated: 2026-05-25T19:23:38Z

Potential uses:

- Study hover/editor lifecycle patterns.
- Learn how an established plugin handles popovers, editor state, and compatibility with Obsidian internals.
- Consider whether comment thread popovers can reuse similar UI concepts.

Caution:

- Do not copy code without checking license compatibility and attribution requirements.
- Treat it as a reference, not a dependency, unless we explicitly evaluate its API surface and maintenance risk.

## Suggested build order

1. Scaffold repo from Obsidian sample plugin.
2. Add public repo hygiene: MIT, README, SECURITY, CONTRIBUTING, CODEOWNERS.
3. Implement thread data model and JSON persistence.
4. Implement sidebar thread list.
5. Implement selected-text comment creation.
6. Implement CodeMirror highlight decorations.
7. Implement patch preview/apply/reject for custom replace patches.
8. Implement provider contract.
9. Implement Hermes provider via file-backed runner.
10. Add Claude Code provider as read-only suggestion provider.
11. Add Codex provider as read-only suggestion provider with git-workdir requirement.
12. Add tests for anchor model, thread lifecycle, provider output parsing, and patch validation.
13. Add release workflow producing Obsidian release artifacts.
14. Dogfood on Noah's vault before public announcement.

## Open decisions

- Final repo name.
- Whether primary public branding says `Steve`, `Hermes`, or generic `Agent Comments`.
- Whether Claude Code/Codex providers live inside the plugin directly or in a companion bridge CLI.
- Whether thread state should live only in plugin data or optionally sync via a visible vault folder.
- Whether MVP should include a Hermes watcher script in-repo or only define the provider contract.

## Current recommendation

Proceed with a public repo named `mogilventures/obsidian-agent-comments`.

Keep the plugin generic. Make Hermes/Steve, Claude Code, and Codex adapters. The plugin owns UI, anchoring, diff preview, approval, and thread state. Providers only produce replies and suggested patches.

This separation makes the project useful beyond Noah while preserving the Steve workflow as the first-class dogfood path.
