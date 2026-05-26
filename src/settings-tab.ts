/**
 * Plugin settings tab.
 * Provides UI for configuring thread storage, providers, and consent.
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import type AgentCommentsPlugin from './main';

export class AgentCommentsSettingsTab extends PluginSettingTab {
  plugin: AgentCommentsPlugin;

  constructor(app: App, plugin: AgentCommentsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('agent-comments-settings');

    containerEl.createEl('h2', { text: 'Agent Comments' });

    // ── General ──────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'General' });

    new Setting(containerEl)
      .setName('Thread storage directory')
      .setDesc(
        'Directory where comment thread JSON files are stored. ' +
        'Relative paths are resolved from the plugin directory. ' +
        'Must be accessible for Obsidian Sync to propagate thread state.'
      )
      .addText(text =>
        text
          .setPlaceholder('threads')
          .setValue(this.plugin.settings.threadDirectory)
          .onChange(async value => {
            this.plugin.settings.threadDirectory = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Providers ─────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Providers' });

    containerEl.createEl('p', {
      text: 'Enable a provider to allow threads tagged with its @mention to be processed. ' +
            'Configure the bridge path to the directory where request/response files are exchanged.',
      cls: 'setting-item-description',
    });

    // Hermes
    containerEl.createEl('h4', { text: 'Hermes (@Steve / @Hermes)' });

    new Setting(containerEl)
      .setName('Enable Hermes')
      .setDesc('Process @Steve and @Hermes mentions via the Hermes file bridge.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.providers.hermes.enabled)
          .onChange(async value => {
            this.plugin.settings.providers.hermes.enabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Hermes bridge path')
      .setDesc(
        'Absolute path to the Hermes bridge directory. ' +
        'The plugin writes requests to <bridgePath>/pending/ and reads responses from <bridgePath>/complete/.'
      )
      .addText(text =>
        text
          .setPlaceholder('/path/to/hermes-bridge')
          .setValue(this.plugin.settings.providers.hermes.bridgePath)
          .onChange(async value => {
            this.plugin.settings.providers.hermes.bridgePath = value;
            await this.plugin.saveSettings();
          })
      );

    // Claude Code
    containerEl.createEl('h4', { text: 'Claude Code (@Claude / @ClaudeCode)' });

    new Setting(containerEl)
      .setName('Enable Claude Code')
      .setDesc('Process @Claude and @ClaudeCode mentions via the Claude Code file bridge.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.providers.claudeCode.enabled)
          .onChange(async value => {
            this.plugin.settings.providers.claudeCode.enabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Claude Code bridge path')
      .setDesc(
        'Absolute path to the Claude Code bridge directory. ' +
        'The bridge runner invokes `claude -p` in print mode. ' +
        'Never points directly to vault content.'
      )
      .addText(text =>
        text
          .setPlaceholder('/path/to/claude-code-bridge')
          .setValue(this.plugin.settings.providers.claudeCode.bridgePath)
          .onChange(async value => {
            this.plugin.settings.providers.claudeCode.bridgePath = value;
            await this.plugin.saveSettings();
          })
      );

    // Codex
    containerEl.createEl('h4', { text: 'Codex (@Codex)' });

    new Setting(containerEl)
      .setName('Enable Codex')
      .setDesc('Process @Codex mentions via the Codex file bridge. Requires a git repository.')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.providers.codex.enabled)
          .onChange(async value => {
            this.plugin.settings.providers.codex.enabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Codex bridge path')
      .setDesc(
        'Absolute path to the Codex bridge directory. ' +
        'Must be within or adjacent to a git repository. ' +
        'The bridge runner invokes `codex exec` from the configured git workdir.'
      )
      .addText(text =>
        text
          .setPlaceholder('/path/to/codex-bridge')
          .setValue(this.plugin.settings.providers.codex.bridgePath)
          .onChange(async value => {
            this.plugin.settings.providers.codex.bridgePath = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Storage ───────────────────────────────────────────────
    containerEl.createEl('h3', { text: 'Storage' });

    const storageDesc = containerEl.createEl('p', {
      cls: 'setting-item-description',
    });
    storageDesc.appendText(
      'Each comment thread is stored as a single JSON file in the thread directory. ' +
      'This design is sync-friendly: Obsidian Sync, iCloud Drive, or Dropbox can propagate ' +
      'thread state between your devices and to provider bridges running on a VPS. '
    );
    const contractLink = storageDesc.createEl('a', {
      text: 'See provider-contract.md',
      href: 'https://github.com/mogilventures/obsidian-agent-comments/blob/main/docs/provider-contract.md',
    });
    contractLink.setAttr('target', '_blank');
    storageDesc.appendText(' for the full bridge protocol.');

    // ── Privacy & Consent ──────────────────────────────────────
    containerEl.createEl('h3', { text: 'Privacy & Consent' });

    if (!this.plugin.settings.consentGiven) {
      const warning = containerEl.createDiv({ cls: 'consent-warning' });
      warning.createEl('strong', { text: 'Consent required' });
      warning.appendText(
        ' — Agent Comments can send note content to local or remote AI systems ' +
        '(Hermes, Claude Code, Codex) depending on which providers you enable and configure. ' +
        'Please read the disclosure below before enabling any providers.'
      );
    }

    new Setting(containerEl)
      .setName('I understand that note content may be shared')
      .setDesc(
        'When you submit a comment thread, the selected text, surrounding context, and ' +
        'the full thread JSON are written to the configured bridge directory. If your bridge ' +
        'points to a directory synced by Obsidian Sync or cloud storage, that content may ' +
        'reach a remote server. No content is sent silently — you must explicitly submit a ' +
        'thread, and all patches require manual acceptance. Providers never edit your vault directly.'
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.consentGiven)
          .onChange(async value => {
            this.plugin.settings.consentGiven = value;
            await this.plugin.saveSettings();
            this.display(); // re-render to show/hide warning
          })
      );
  }
}
