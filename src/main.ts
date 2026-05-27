/**
 * Agent Comments Plugin — main entry point.
 * Registers commands, the sidebar view, decoration extension, and settings tab.
 */

import { App, Editor, MarkdownView, Modal, Notice, Plugin, TFile } from 'obsidian';
import type { AgentProvider, PluginSettings, ProviderSettings } from './types';
import { AgentThread, SuggestedPatch } from './types';
import { ThreadStore } from './thread-store';
import { AgentCommentsSidebar, VIEW_TYPE } from './sidebar-view';
import type { ThreadActionHandlers } from './sidebar-view';
import { AgentCommentsSettingsTab } from './settings-tab';
import { createThread, transitionThread, mergeProviderResponse, canTransition } from './thread-lifecycle';
import { validatePatch, applyPatch } from './patch';
import { validateProviderResponse } from './validation';
import { buildDecorationExtension } from './decorations';
import { HermesProvider } from './providers/hermes';
import { ClaudeCodeProvider } from './providers/claude-code';
import { CodexProvider } from './providers/codex';

export const DEFAULT_SETTINGS: PluginSettings = {
  threadDirectory: 'threads',
  providers: {
    hermes: { enabled: false, bridgePath: '' },
    claudeCode: { enabled: false, bridgePath: '' },
    codex: { enabled: false, bridgePath: '' },
  },
  consentGiven: false,
};

export default class AgentCommentsPlugin extends Plugin {
  settings!: PluginSettings;
  threadStore!: ThreadStore;
  private sidebar: AgentCommentsSidebar | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();

    // Resolve thread directory relative to plugin directory if not absolute
    const threadDir = this.resolveThreadDir();
    this.threadStore = new ThreadStore(this.app.vault, threadDir);
    await this.threadStore.ensureDir();

    // Register sidebar view
    this.registerView(VIEW_TYPE, (leaf) => {
      this.sidebar = new AgentCommentsSidebar(leaf);
      return this.sidebar;
    });

    // Register CodeMirror decoration extension
    // Captures current thread state via closure; decorations refresh on the next
    // CM transaction after refreshSidebar() updates _cachedThreads (MVP limitation).
    const getThreadsForDecorations = (): AgentThread[] => {
      return this._cachedThreads;
    };
    this.registerEditorExtension(buildDecorationExtension(getThreadsForDecorations));

    // ── Commands ──────────────────────────────────────────────

    this.addCommand({
      id: 'add-agent-comment',
      name: 'Add Agent Comment',
      callback: () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) {
          new Notice('Open a Markdown note first');
          return;
        }
        this.handleAddComment(view.editor, view.file);
      },
    });

    this.addCommand({
      id: 'open-agent-comments-sidebar',
      name: 'Open Agent Comments Sidebar',
      callback: () => {
        this.openSidebar();
      },
    });

    this.addCommand({
      id: 'apply-pending-patch',
      name: 'Apply Pending Patch',
      callback: async () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.file) {
          new Notice('Open a Markdown note first');
          return;
        }
        const threads = await this.threadStore.listThreadsForFile(view.file.path);
        const withPatch = threads.find(
          t => t.status === 'responded' && t.suggestedPatch !== null
        );
        if (!withPatch) {
          new Notice('No pending patches for this file');
          return;
        }
        await this.handleApplyPatch(withPatch);
      },
    });

    this.addCommand({
      id: 'poll-agent-comment-responses',
      name: 'Poll Agent Comment Responses',
      callback: async () => {
        await this.pollProviderResponses();
      },
    });

    // Add ribbon icon
    this.addRibbonIcon('message-square', 'Agent Comments', () => {
      this.openSidebar();
    });

    // Register settings tab
    this.addSettingTab(new AgentCommentsSettingsTab(this.app, this));

    // Refresh sidebar when the active file changes
    this.registerEvent(
      this.app.workspace.on('active-leaf-change', () => {
        this.refreshSidebar();
      })
    );
  }

  async onunload(): Promise<void> {
    this.sidebar = null;
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    // Deep-merge providers
    this.settings.providers = Object.assign(
      {},
      DEFAULT_SETTINGS.providers,
      data?.providers ?? {}
    );
    this.settings.providers.hermes = Object.assign(
      {},
      DEFAULT_SETTINGS.providers.hermes,
      data?.providers?.hermes ?? {}
    );
    this.settings.providers.claudeCode = Object.assign(
      {},
      DEFAULT_SETTINGS.providers.claudeCode,
      data?.providers?.claudeCode ?? {}
    );
    this.settings.providers.codex = Object.assign(
      {},
      DEFAULT_SETTINGS.providers.codex,
      data?.providers?.codex ?? {}
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  /** Open or reveal the Agent Comments sidebar leaf. */
  async openSidebar(): Promise<void> {
    const workspace = this.app.workspace;

    const existing = workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) {
      workspace.revealLeaf(existing[0]);
      await this.refreshSidebar();
      return;
    }

    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE, active: true });
      workspace.revealLeaf(leaf);
    }

    await this.refreshSidebar();
  }

  /** Refresh sidebar thread list for the active file. */
  async refreshSidebar(): Promise<void> {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    const file = activeView?.file ?? null;

    let threads: AgentThread[] = [];
    if (file) {
      threads = await this.threadStore.listThreadsForFile(file.path);
    }

    this._cachedThreads = threads;

    const handlers: ThreadActionHandlers = {
      onAccept: (id) => this.handleSidebarAccept(id),
      onReject: (id) => this.handleSidebarReject(id),
      onResolve: (id) => this.handleSidebarResolve(id),
    };

    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    for (const leaf of leaves) {
      const view = leaf.view;
      if (view instanceof AgentCommentsSidebar) {
        view.render(threads, handlers);
      }
    }
  }

  /**
   * Open the Add Comment modal. On submit:
   * 1. Create thread (open status), save immediately.
   * 2. If no routed provider or provider not configured → leave as open, notice.
   * 3. If consent not yet given → show ConsentModal; on accept save consent + submit.
   * 4. If provider configured and consent given → transition open→pending, submit to bridge.
   */
  async handleAddComment(editor: Editor, file: TFile): Promise<void> {
    const selection = editor.getSelection();
    if (!selection) {
      new Notice('Select some text first');
      return;
    }

    const content = editor.getValue();
    const from = editor.getCursor('from');
    const to = editor.getCursor('to');
    const startOffset = editor.posToOffset(from);
    const endOffset = editor.posToOffset(to);

    const prefix = content.slice(Math.max(0, startOffset - 100), startOffset);
    const suffix = content.slice(endOffset, Math.min(content.length, endOffset + 100));

    const modal = new AddCommentModal(this.app, async (commentBody: string) => {
      const id = this.threadStore.generateThreadId();

      const thread = createThread({
        id,
        file: file.path,
        anchor: {
          quote: selection,
          prefix,
          suffix,
          startOffset,
          endOffset,
          headingPath: [],
          blockId: null,
          contentHash: this.simpleHash(content),
        },
        initialMessage: commentBody,
      });

      // Always persist immediately so the comment is never lost.
      await this.threadStore.saveThread(thread);
      await this.refreshSidebar();

      // Resolve provider settings
      const providerSettings = thread.provider
        ? this.getProviderSettings(thread.provider)
        : null;

      if (!thread.provider || !providerSettings?.enabled || !providerSettings.bridgePath) {
        new Notice(
          thread.provider
            ? 'Comment saved locally — provider is not configured'
            : 'Comment saved'
        );
        return;
      }

      // Require consent before sharing note content with any agent process.
      if (!this.settings.consentGiven) {
        new ConsentModal(this.app, async (accepted: boolean) => {
          if (!accepted) {
            new Notice('Comment saved locally — consent not given');
            return;
          }
          this.settings.consentGiven = true;
          await this.saveSettings();
          await this.submitToProvider(thread, providerSettings.bridgePath);
        }).open();
        return;
      }

      await this.submitToProvider(thread, providerSettings.bridgePath);
    });

    modal.open();
  }

  /**
   * Poll all configured provider bridge directories for completed responses.
   * Validates each response before merging, saves, and refreshes the sidebar.
   */
  async pollProviderResponses(): Promise<void> {
    const allThreads = await this.threadStore.listAllThreads();
    const active = allThreads.filter(
      t => t.status === 'pending' || t.status === 'processing'
    );

    if (active.length === 0) {
      new Notice('No pending threads to poll');
      return;
    }

    let updated = 0;
    let errors = 0;

    for (const thread of active) {
      if (!thread.provider) continue;

      const providerSettings = this.getProviderSettings(thread.provider);
      if (!providerSettings?.enabled || !providerSettings.bridgePath) continue;

      const provider = this.buildProvider(thread.provider, providerSettings.bridgePath);
      if (!provider?.pollThread) continue;

      try {
        const response = await provider.pollThread(thread.id);
        if (!response) continue;

        const validation = validateProviderResponse(response, thread);
        if (!validation.valid) {
          console.error(`[Agent Comments] Invalid provider response for ${thread.id}: ${validation.error}`);
          errors++;
          continue;
        }

        const merged = mergeProviderResponse(thread, response);
        await this.threadStore.saveThread(merged);
        updated++;
      } catch {
        errors++;
      }
    }

    await this.refreshSidebar();

    if (updated > 0) {
      new Notice(`Received ${updated} response${updated > 1 ? 's' : ''}`);
    } else if (errors > 0) {
      new Notice(`Poll error — check ${errors} thread${errors > 1 ? 's' : ''}`);
    } else {
      new Notice('No new responses');
    }
  }

  /**
   * Show the patch diff modal and apply on user confirmation.
   */
  async handleApplyPatch(thread: AgentThread): Promise<void> {
    if (!thread.suggestedPatch) return;

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView || !activeView.file) {
      new Notice('Please open the file to apply the patch');
      return;
    }

    const content = await this.app.vault.read(activeView.file);

    if (!validatePatch(thread.suggestedPatch, content, thread.anchor.startOffset)) {
      new Notice('Patch is no longer valid — the source text may have changed');
      const updated = transitionThread(thread, 'error', 'user');
      await this.threadStore.saveThread(updated);
      return;
    }

    const modal = new PatchDiffModal(
      this.app,
      thread.suggestedPatch,
      async (accepted: boolean) => {
        if (accepted) {
          try {
            const newContent = applyPatch(thread.suggestedPatch!, content, thread.anchor.startOffset);
            await this.app.vault.modify(activeView.file!, newContent);
            const updated = transitionThread(thread, 'accepted', 'user');
            await this.threadStore.saveThread(updated);
            new Notice('Patch applied');
          } catch (e) {
            new Notice(`Failed to apply patch: ${(e as Error).message}`);
          }
        } else {
          const updated = transitionThread(thread, 'rejected', 'user');
          await this.threadStore.saveThread(updated);
          new Notice('Patch rejected');
        }
        await this.refreshSidebar();
      }
    );

    modal.open();
  }

  // ── Internal helpers ───────────────────────────────────────

  private _cachedThreads: AgentThread[] = [];

  /**
   * Handle "Accept Patch" button click from the sidebar.
   * Delegates to handleApplyPatch which opens the diff modal.
   */
  private async handleSidebarAccept(threadId: string): Promise<void> {
    const thread = this._cachedThreads.find(t => t.id === threadId);
    if (!thread) return;
    await this.handleApplyPatch(thread);
  }

  /**
   * Handle "Reject Patch" button click from the sidebar.
   * Transitions responded → rejected and saves.
   */
  private async handleSidebarReject(threadId: string): Promise<void> {
    const thread = this._cachedThreads.find(t => t.id === threadId);
    if (!thread) return;
    try {
      const updated = transitionThread(thread, 'rejected', 'user');
      await this.threadStore.saveThread(updated);
      await this.refreshSidebar();
      new Notice('Patch rejected');
    } catch (e) {
      new Notice(`Cannot reject: ${(e as Error).message}`);
    }
  }

  /**
   * Handle "Resolve" button click from the sidebar.
   * Transitions the thread to resolved if valid for its current status.
   */
  private async handleSidebarResolve(threadId: string): Promise<void> {
    const thread = this._cachedThreads.find(t => t.id === threadId);
    if (!thread) return;
    if (!canTransition(thread.status, 'resolved')) {
      new Notice(`Cannot resolve a thread with status "${thread.status}"`);
      return;
    }
    try {
      const updated = transitionThread(thread, 'resolved', 'user');
      await this.threadStore.saveThread(updated);
      await this.refreshSidebar();
      new Notice('Thread resolved');
    } catch (e) {
      new Notice(`Cannot resolve: ${(e as Error).message}`);
    }
  }

  /**
   * Transition a thread from open → pending and submit it to the provider bridge.
   * On submission failure, transitions to error so the user can see the problem.
   */
  private async submitToProvider(thread: AgentThread, bridgePath: string): Promise<void> {
    const pending = transitionThread(thread, 'pending', 'user');
    await this.threadStore.saveThread(pending);

    try {
      const provider = this.buildProvider(thread.provider!, bridgePath);
      if (!provider) throw new Error(`Unknown provider: ${thread.provider}`);
      await provider.submitThread(pending, '');
      await this.refreshSidebar();
      new Notice(`Comment submitted to ${pending.provider}`);
    } catch (e) {
      const errored = transitionThread(pending, 'error', 'system');
      await this.threadStore.saveThread(errored);
      await this.refreshSidebar();
      new Notice(`Submit failed: ${(e as Error).message}`);
    }
  }

  /** Map a provider ID to the stored ProviderSettings, or null if unknown. */
  private getProviderSettings(providerId: string): ProviderSettings | null {
    switch (providerId) {
      case 'hermes':      return this.settings.providers.hermes;
      case 'claude-code': return this.settings.providers.claudeCode;
      case 'codex':       return this.settings.providers.codex;
      default:            return null;
    }
  }

  /** Instantiate the correct provider adapter for the given ID and bridge path. */
  private buildProvider(providerId: string, bridgePath: string): AgentProvider | null {
    switch (providerId) {
      case 'hermes':      return new HermesProvider(bridgePath);
      case 'claude-code': return new ClaudeCodeProvider(bridgePath);
      case 'codex':       return new CodexProvider(bridgePath);
      default:            return null;
    }
  }

  /**
   * Resolve the thread storage directory.
   * Absolute paths are used as-is; relative paths are resolved under the plugin directory.
   */
  private resolveThreadDir(): string {
    const dir = this.settings.threadDirectory || 'threads';
    if (dir.startsWith('/')) {
      return dir;
    }
    const pluginDir = this.manifest.dir ?? '.obsidian/plugins/obsidian-agent-comments';
    return `${pluginDir}/${dir}`;
  }

  private simpleHash(content: string): string {
    // djb2 hash — good enough for anchor staleness detection in MVP
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash) + content.charCodeAt(i);
      hash = hash & hash;
    }
    return (hash >>> 0).toString(16);
  }
}

// ── Modals ─────────────────────────────────────────────────────────────────

class AddCommentModal extends Modal {
  private onSubmit: (body: string) => Promise<void>;

  constructor(app: App, onSubmit: (body: string) => Promise<void>) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('agent-comment-modal');
    contentEl.createEl('h3', { text: 'Add Agent Comment' });

    const body = contentEl.createDiv({ cls: 'modal-body' });

    const textarea = body.createEl('textarea', {
      placeholder: '@Steve review this paragraph\n@Claude suggest a rewrite',
    });
    textarea.rows = 4;

    body.createDiv({
      cls: 'modal-hint',
      text: 'Tag @Steve, @Hermes, @Claude, @ClaudeCode, or @Codex to route to a provider.',
    });

    const actions = body.createDiv({ cls: 'modal-actions' });

    const cancelBtn = actions.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const submitBtn = actions.createEl('button', {
      cls: 'mod-cta',
      text: 'Add Comment',
    });
    submitBtn.addEventListener('click', async () => {
      const value = textarea.value.trim();
      if (!value) {
        new Notice('Comment cannot be empty');
        return;
      }
      this.close();
      await this.onSubmit(value);
    });

    textarea.addEventListener('keydown', async (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        const value = textarea.value.trim();
        if (value) {
          this.close();
          await this.onSubmit(value);
        }
      }
    });

    setTimeout(() => textarea.focus(), 50);
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

/**
 * Shown before the first submission to any provider.
 * Informs the user that note content will leave the vault.
 */
class ConsentModal extends Modal {
  private onDecision: (accepted: boolean) => Promise<void>;

  constructor(app: App, onDecision: (accepted: boolean) => Promise<void>) {
    super(app);
    this.onDecision = onDecision;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('agent-comment-modal');
    contentEl.createEl('h3', { text: 'Allow Agent Access' });

    const body = contentEl.createDiv({ cls: 'modal-body' });
    body.createEl('p', {
      text:
        'This comment will be submitted to a configured AI agent (Hermes, Claude Code, or Codex). ' +
        'The selected text and surrounding context from your note will be written to the bridge ' +
        'directory and may sync to a VPS running the agent.',
    });
    body.createEl('p', {
      text:
        'The agent runs in a process you control — your notes are not sent to Anthropic or any ' +
        'third party by this plugin.',
    });
    body.createEl('p', {
      cls: 'modal-hint',
      text: 'You can revoke consent at any time in plugin settings.',
    });

    const actions = body.createDiv({ cls: 'modal-actions' });

    const cancelBtn = actions.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', async () => {
      this.close();
      await this.onDecision(false);
    });

    const acceptBtn = actions.createEl('button', {
      cls: 'mod-cta',
      text: 'Allow & Submit',
    });
    acceptBtn.addEventListener('click', async () => {
      this.close();
      await this.onDecision(true);
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class PatchDiffModal extends Modal {
  private patch: SuggestedPatch;
  private onDecision: (accepted: boolean) => Promise<void>;

  constructor(
    app: App,
    patch: SuggestedPatch,
    onDecision: (accepted: boolean) => Promise<void>
  ) {
    super(app);
    this.patch = patch;
    this.onDecision = onDecision;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass('agent-comment-modal');
    contentEl.createEl('h3', { text: 'Review Suggested Patch' });

    const body = contentEl.createDiv({ cls: 'modal-body' });

    const diffBlock = body.createDiv({ cls: 'patch-diff-block' });

    const oldBlock = diffBlock.createDiv({ cls: 'patch-old-text' });
    oldBlock.createDiv({ cls: 'diff-label', text: 'Before' });
    oldBlock.createDiv({ cls: 'diff-content', text: this.patch.oldText });

    const newBlock = diffBlock.createDiv({ cls: 'patch-new-text' });
    newBlock.createDiv({ cls: 'diff-label', text: 'After' });
    newBlock.createDiv({ cls: 'diff-content', text: this.patch.newText });

    body.createDiv({
      cls: 'modal-hint',
      text: 'Applying this patch cannot be undone automatically. Use Ctrl+Z to revert if needed.',
    });

    const actions = body.createDiv({ cls: 'modal-actions' });

    const rejectBtn = actions.createEl('button', {
      cls: 'mod-warning',
      text: 'Reject',
    });
    rejectBtn.addEventListener('click', async () => {
      this.close();
      await this.onDecision(false);
    });

    const applyBtn = actions.createEl('button', {
      cls: 'mod-cta',
      text: 'Apply Patch',
    });
    applyBtn.addEventListener('click', async () => {
      this.close();
      await this.onDecision(true);
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
