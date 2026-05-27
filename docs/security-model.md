# Security Model

This document describes the threat model for the Obsidian Agent Comments plugin.

---

## Assets

| Asset | Sensitivity |
|---|---|
| Vault note content | High — personal/private writing |
| Plugin settings (`data.json`) | Medium — may contain bridge paths |
| Thread JSON files | High — contain excerpts from vault notes |
| Provider CLI auth tokens | High — stored in external CLI credential stores |

---

## Threats

### 1. Vault content disclosure

**Risk:** Note content (anchor quotes, surrounding context, full message bodies) is sent to a provider bridge or CLI. If the bridge syncs to a VPS, content traverses a sync channel and is processed on a remote machine.

**Mitigations:**
- First-use consent prompt explicitly discloses that note content will be shared with the configured provider.
- Each provider has an enabled/disabled toggle; no provider is enabled by default.
- The provider request contains only the thread object: the selected quote, a short prefix/suffix for context, and message bodies. It does not include the full vault file unless the provider runner explicitly requests it (Hermes only, under controlled scope).
- Thread JSON files are stored in `.obsidian/plugins/obsidian-agent-comments/` which Obsidian Sync encrypts end-to-end (when enabled by the user).

### 2. Prompt injection

**Risk:** A malicious note author could craft anchor text or comment bodies that, when included in a provider prompt, cause the provider to take unintended actions (e.g., instruct Hermes to read unrelated files or exfiltrate data).

**Mitigations:**
- All provider prompts must treat `anchor.quote`, `anchor.prefix/suffix`, and `messages[*].body` as untrusted user-supplied data, not as instructions.
- System prompt must be clearly separated from note content.
- Claude Code and Codex are invoked with `--allowedTools ""` (no tool use) in MVP.
- The Hermes runner is expected to apply prompt hardening; see provider-contract.md.

### 3. Plaintext plugin settings

**Risk:** Plugin settings are stored in `.obsidian/plugins/obsidian-agent-comments/data.json` in plaintext. Any process with read access to the vault can read this file.

**Mitigations:**
- Do not store API keys or bearer tokens in plugin settings. The settings schema (`PluginSettings`) does not include an API key field.
- Use the CLI's own credential store (Hermes config, `claude` CLI keychain, `codex` CLI auth) for secrets.
- Bridge path and enabled/disabled flags stored in settings are not sensitive.

### 4. Localhost bridge authentication (future)

**Risk:** If a future HTTP bridge binds to localhost, other processes on the machine could call it without authorization.

**Mitigations (planned, not in MVP):**
- Bridge must bind only to `127.0.0.1`/`::1`, never `0.0.0.0`.
- All requests must include a shared bearer token generated at plugin startup and stored in memory only (not persisted to disk).
- Token must be rotated on each plugin reload.

### 5. Sync conflicts

**Risk:** Obsidian Sync or another sync client may produce conflict copies of thread JSON files, causing the plugin to display stale or duplicated thread state.

**Mitigations:**
- Thread files use unique IDs; the plugin ignores files that do not match the expected naming pattern.
- The `schemaVersion` field allows the plugin to reject files written by incompatible future versions.
- Conflict copies (files with Obsidian Sync conflict suffixes) are not loaded; only `thread_<id>.json` files are parsed.
- MVP does not attempt to merge conflict copies; the user must resolve manually.

### 6. No auto-apply

**Risk:** Silent patch application could overwrite user writing without review.

**Mitigation:**
- The plugin never applies a `suggestedPatch` without an explicit user click on **Apply**.
- The diff view always shows old text and new text before apply.
- There is no configuration option to enable auto-apply in MVP.

---

## Out of scope

- Obsidian application vulnerabilities (report to Obsidian).
- Provider CLI vulnerabilities (report to respective projects).
- Vault content at rest (Obsidian's responsibility).
- Network-level interception of Obsidian Sync traffic (Obsidian's responsibility; they use E2EE).

---

## Responsible disclosure

See [`SECURITY.md`](../SECURITY.md).
