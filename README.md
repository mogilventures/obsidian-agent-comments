# Obsidian Agent Comments

Inline AI-assisted comment threads for [Obsidian](https://obsidian.md). Select text in any Markdown note, add a comment, tag `@Hermes`, `@Claude`, or `@Codex`, and receive a threaded reply with a suggested patch — all reviewed and applied by you.

> **Status: MVP (v0.1.0)** — Desktop only, Live Preview mode, file-based Hermes bridge, Claude Code and Codex provider stubs. Not yet in the Obsidian community plugin directory; install manually from a GitHub release.

---

## Features

- Select text and run **Add Agent Comment** to anchor a comment to any range.
- Tag mentions to route to configured providers: `@Hermes`/`@Steve`, `@Claude`, `@Codex`.
- Right-sidebar thread panel shows all threads for the current note.
- Provider returns a reply and an optional `replace` patch.
- You see the old/new diff and choose **Apply** or **Reject**.
- Nothing is applied silently — explicit approval required.
- Sidecar JSON thread storage; threads survive vault restarts.

## Provider model

The plugin owns the UI, anchoring, diff preview, approval workflow, and thread state. Providers only produce replies and suggested patches.

| Provider | Transport | Notes |
|---|---|---|
| **Hermes** | File queue (`pending/` → `complete/`) | Primary. Works locally or over Obsidian Sync with a VPS runner. |
| **Claude Code** | File queue (`pending/` → `complete/`) | Out-of-process bridge runner invokes `claude -p`. Plugin never calls the CLI directly. |
| **Codex** | File queue (`pending/` → `complete/`) | Out-of-process bridge runner invokes `codex exec` inside a git working directory. |

See [`docs/provider-contract.md`](docs/provider-contract.md) for the exact input/output schema.

## Architecture: local vs VPS/Obsidian Sync

```
┌─────────────────────────┐
│  Obsidian (desktop)     │
│  Plugin writes:         │
│    bridge/pending/      │──── Obsidian Sync / cloud folder ────►  VPS / local runner
│  Plugin reads:          │◄───────────────────────────────────    writes bridge/complete/
│    bridge/complete/     │
└─────────────────────────┘
```

The Hermes bridge path is a normal folder you configure. If it lives inside a synced vault or cloud drive, a Hermes runner on any machine can pick up requests and write back responses without any open network port on the Obsidian machine.

For Claude Code and Codex, the CLI runs locally on the same machine as Obsidian.

## Security and consent

- On first use the plugin displays a consent prompt explaining that note content will be sent to the configured provider (local CLI or file bridge that may sync to a remote machine).
- Each provider has an enabled/disabled toggle in settings.
- Plugin settings are stored in `.obsidian/plugins/obsidian-agent-comments/data.json` (plaintext). Do not store API keys there; use the CLI's own auth stores instead.
- The plugin never auto-applies a patch. You must click **Apply**.
- Provider prompts treat note content as untrusted input. Raw note text is never interpolated into shell commands.
- Local HTTP bridge (future) will bind only to `127.0.0.1` and require a bearer token.

See [`docs/security-model.md`](docs/security-model.md) for the full threat model.

## Install (manual, from GitHub release)

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/mogilventures/obsidian-agent-comments/releases).
2. Copy all three files into `.obsidian/plugins/obsidian-agent-comments/` inside your vault.
3. In Obsidian → Settings → Community Plugins, enable **Agent Comments**.
4. Configure at least one provider in the plugin settings.

## Development

**Prerequisites:** Node.js 20+, TypeScript.

```bash
npm ci            # install dependencies
npm test          # run jest unit tests
npm run build     # type-check + esbuild bundle → main.js
npm run lint      # tsc --noEmit type check
npm run dev       # esbuild watch mode
```

Output artifacts for an Obsidian release: `main.js`, `manifest.json`, `styles.css`.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for full dev setup and release notes process.

## Roadmap

See [`docs/roadmap.md`](docs/roadmap.md).

## License

MIT — see [`LICENSE`](LICENSE).

## Security disclosures

See [`SECURITY.md`](SECURITY.md).
