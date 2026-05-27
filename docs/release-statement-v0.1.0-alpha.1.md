# Release statement — v0.1.0-alpha.1

Obsidian Agent Comments is a developer alpha for inline, AI-assisted comment threads in Obsidian.

The plugin lets you select text in a Markdown note, add a Google Docs/GitHub PR-style comment, mention a configured agent provider such as `@Hermes`, `@Steve`, `@Claude`, or `@Codex`, and review an agent reply plus optional suggested replacement patch before applying it.

## What this alpha is for

This release is intended for technical users who want to test the core Obsidian-side workflow:

- creating anchored comment threads on selected Markdown text;
- viewing thread history in the sidebar;
- storing comment history as sidecar JSON;
- routing mentions to provider adapters;
- using a file-based bridge that can work locally or through a synced vault/VPS setup;
- reviewing suggested patches before any note is modified.

## Safety model

The plugin does not silently edit notes. Providers only return replies and suggested patches. The user must explicitly choose **Apply** before note content changes.

Provider responses and note content are treated as untrusted. The MVP validates provider response JSON, checks provider/thread identity, limits supported patch shape to `replace`, and applies patches only through the plugin approval flow.

## Privacy note

Comment threads are stored as JSON files. These files may contain selected note text, short surrounding context, user comments, agent replies, and suggested rewrites. If the thread directory or bridge path is inside a synced vault, that conversation history syncs with the vault.

Do not store API keys or provider tokens in plugin settings. Provider authentication should stay in the external CLI/tool credential stores.

## Current limitations

This is not yet a general-user Obsidian Community Plugin release.

Known alpha limitations:

- desktop / Live Preview first;
- release packaging and GitHub Actions are pending a GitHub auth refresh with `workflow` scope;
- the Obsidian plugin side is implemented, but external bridge runner scripts for Hermes, Claude Code, and Codex still need packaging;
- provider responses can be tested via bridge JSON, but real `@Steve` automation needs the bridge runner follow-up;
- no mobile support;
- no Reading View rendering path yet;
- no retention settings for deleting or archiving resolved thread history yet.

## Recommended release label

Use `v0.1.0-alpha.1` and mark it as a pre-release.

Suggested public description:

> Developer alpha of Obsidian Agent Comments: inline AI-assisted review comments for Obsidian notes. Select Markdown text, start a thread, mention an agent provider, and review suggested patches before applying. This alpha focuses on safe local/VPS-compatible sidecar thread storage and explicit user approval; external provider runners are still being packaged.

## Manual install once artifacts are available

Download or build these files:

- `main.js`
- `manifest.json`
- `styles.css`

Copy them into your vault:

```text
<your-vault>/.obsidian/plugins/obsidian-agent-comments/
```

Then enable **Agent Comments** in Obsidian Settings → Community plugins.
