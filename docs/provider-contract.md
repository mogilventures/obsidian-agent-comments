# Provider Contract

This document defines the exact input/output contract between the Obsidian Agent Comments plugin and any provider bridge (Hermes, Claude Code, Codex, or a future adapter).

The plugin owns:
- UI, anchoring, decoration, diff preview, and thread state.
- Applying or rejecting patches (always requires explicit user approval).

Providers own:
- Generating replies and suggested patches.
- **Nothing else.** Providers must never write directly to vault files.

---

## Thread JSON schema

The plugin writes the full thread object as the provider request. The schema version is `1`.

```jsonc
{
  "id": "thread_abc123",          // unique thread ID (string)
  "schemaVersion": 1,             // always 1 in MVP
  "status": "pending",            // ThreadStatus — see below
  "file": "Writing/Draft.md",     // vault-relative file path
  "createdAt": "2026-05-26T07:00:00Z",
  "updatedAt": "2026-05-26T07:00:00Z",
  "anchor": {
    "quote": "the selected text",
    "prefix": "text immediately before",
    "suffix": "text immediately after",
    "startOffset": 1024,          // char offset at creation time
    "endOffset": 1102,
    "headingPath": ["Section"],   // breadcrumb headings
    "blockId": null,              // Obsidian block ID or null
    "contentHash": "sha1hex"      // file content hash at creation time
  },
  "messages": [
    {
      "id": "msg_1",
      "author": "user",                      // "user" or "agent:<providerId>"
      "body": "@Hermes tighten this argument",
      "createdAt": "2026-05-26T07:00:00Z"
    }
  ],
  "mentions": ["Hermes"],         // deduplicated mention tokens
  "provider": "hermes",           // resolved provider ID
  "suggestedPatch": null,         // SuggestedPatch or null
  "audit": []                     // append-only AuditEntry[]
}
```

### ThreadStatus values

```
open         – thread created, no mention yet dispatched
pending      – dispatched to provider, awaiting pickup
processing   – provider has acknowledged pickup
responded    – provider wrote a response
accepted     – user applied the suggested patch
rejected     – user rejected the suggested patch
resolved     – thread closed without patch
lost_anchor  – original text range can no longer be found
error        – provider or plugin error
```

---

## Provider response schema

The provider writes a response JSON file. The plugin polls for it and applies the update to the thread.

```jsonc
{
  "threadId": "thread_abc123",
  "status": "responded",          // typically "responded" or "error"
  "message": {
    "id": "msg_2",
    "author": "agent:hermes",     // "agent:<providerId>"
    "body": "Suggested rewrite below…",
    "createdAt": "2026-05-26T07:05:00Z"
  },
  "suggestedPatch": {             // null if no patch
    "type": "replace",
    "anchorId": "thread_abc123",  // matches thread.id
    "oldText": "the selected text",
    "newText": "the improved text"
  },
  "metadata": {
    "provider": "hermes",
    "model": "claude-opus-4-7",   // optional
    "durationMs": 4200            // optional
  }
}
```

`suggestedPatch` must be `null` or a valid `replace` patch. No other patch types are supported in MVP.

---

## Hermes file-based bridge flow

```
plugin (Obsidian machine)             Hermes runner (local or VPS via Obsidian Sync)
────────────────────────────────────  ──────────────────────────────────────────────
1. Write thread JSON →
   <bridgePath>/pending/thread_<id>.json

                                      2. Runner detects new file in pending/
                                      3. Moves file to processing/ (signals pickup)
                                      4. Calls LLM, assembles response JSON
                                      5. Write response →
                                         <bridgePath>/complete/thread_<id>.json

6. Plugin polls complete/ on interval
7. Reads response, applies to thread state
8. Removes or archives complete/ file
```

`bridgePath` is configured in plugin settings. It may be:
- A local directory (runner on the same machine).
- A directory inside an Obsidian Sync vault or any synced cloud folder (runner on a VPS that has the same sync client installed).

The runner must treat the thread's `anchor.quote` and `messages[*].body` as untrusted user-supplied input in all LLM prompts.

---

## Claude Code provider flow

```bash
claude -p "<system prompt>" \
       --allowedTools "" \
       --model claude-sonnet-4-6 \
       < request.json
```

- The plugin writes a temporary `request.json` with the thread object.
- Claude Code is invoked in print mode (`-p`) with no allowed tools (read-only).
- Output must be valid JSON matching the provider response schema above.
- The plugin deletes `request.json` after the call.
- Claude Code must not be allowed to edit vault files; the plugin applies any accepted patch.

---

## Codex provider flow

```bash
codex exec "<prompt>" < request.json
```

- Codex requires a git repository. The plugin setting `codex.workingDir` must point to a valid git repo.
- Same read-only constraint as Claude Code.
- Same JSON output schema.
- Never use `--yolo` or any auto-apply flag.

---

## Provider safety rules (all providers)

1. **Suggestions only** — providers return `suggestedPatch`; the plugin applies after explicit user approval.
2. **No vault writes** — providers must not write to vault files directly.
3. **Treat note content as untrusted** — never interpolate anchor text or message bodies into shell commands. Pass via file/stdin/JSON.
4. **No auto-escalation** — providers must not spawn subprocesses that write to vault paths not listed in the request.
5. **Timeout** — providers should enforce a processing timeout and write an `error` status response if exceeded.
