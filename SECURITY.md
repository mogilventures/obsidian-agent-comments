# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

Earlier pre-release commits are not supported.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email **security@mogil.io** with:

- A clear description of the vulnerability.
- Steps to reproduce or a minimal proof-of-concept.
- The version or commit hash you tested against.
- Your assessment of impact and exploitability.

We will acknowledge within 3 business days and aim to ship a fix within 14 days for confirmed high-severity issues. We will credit reporters in the release notes unless you request anonymity.

## Scope

In scope:
- Vault content exfiltration beyond what the user explicitly consented to.
- Prompt injection via note content causing a provider to take unintended actions.
- Unauthorized write to vault files without user approval.
- Plugin settings exposing secrets to other processes.
- Localhost bridge authentication bypass (future feature).

Out of scope:
- Issues in Obsidian itself (report to Obsidian).
- Issues in provider CLIs (Hermes, Claude Code, Codex) — report to their respective projects.
- Social engineering.
