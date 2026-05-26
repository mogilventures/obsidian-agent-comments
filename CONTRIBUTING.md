# Contributing to Obsidian Agent Comments

## Dev setup

**Prerequisites:** Node.js 20+, TypeScript (installed via `npm ci`).

```bash
git clone https://github.com/mogilventures/obsidian-agent-comments.git
cd obsidian-agent-comments
npm ci
```

### Running tests

```bash
npm test          # jest unit tests
npm run lint      # tsc --noEmit type check (no ESLint config required)
```

### Building

```bash
npm run build     # type-check then bundle with esbuild → main.js
npm run dev       # esbuild watch mode (incremental, no type-check)
```

The plugin entry point is `src/main.ts`. Build output is `main.js` in the repo root.

### Linking to a local vault

1. Run `npm run build` (or `npm run dev`).
2. Symlink or copy `main.js`, `manifest.json`, and `styles.css` to `.obsidian/plugins/obsidian-agent-comments/` in your vault.
3. Enable the plugin in Obsidian settings.

## Code style

- TypeScript strict mode is enabled.
- No Obsidian imports in `src/types.ts` — all core types are plain TS.
- Providers must implement `AgentProvider` from `src/types.ts` and never make direct LLM API calls; they write/read bridge files or invoke local CLIs only.
- No auto-apply logic. Patches must go through explicit user approval.

## Submitting changes

1. Fork the repo and create a feature branch.
2. Run `npm test` and `npm run build` — both must pass.
3. Open a PR against `main`. Fill in the PR template.
4. A maintainer will review. We aim to respond within 5 business days.

## Release notes (maintainers)

For each release:

1. Update `CHANGELOG.md` under a new `[x.y.z] - YYYY-MM-DD` heading.
2. Bump `version` in both `package.json` and `manifest.json` to match.
3. Push a tag: `git tag v0.x.y && git push origin v0.x.y`.
4. The `release.yml` workflow builds and uploads `main.js`, `manifest.json`, and `styles.css` as release assets automatically.

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be respectful.
