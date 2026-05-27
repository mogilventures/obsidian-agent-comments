/**
 * Agent Comments sidebar view.
 * Renders a list of comment threads for the active file.
 */

import { ItemView, WorkspaceLeaf } from 'obsidian';
import type { AgentThread } from './types';

export const VIEW_TYPE = 'agent-comments-sidebar';

export interface ThreadActionHandlers {
  onAccept: (threadId: string) => Promise<void>;
  onReject: (threadId: string) => Promise<void>;
  onResolve: (threadId: string) => Promise<void>;
}

export class AgentCommentsSidebar extends ItemView {
  private threads: AgentThread[] = [];

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Agent Comments';
  }

  getIcon(): string {
    return 'message-square';
  }

  async onOpen(): Promise<void> {
    this.containerEl.addClass('agent-comments-sidebar');
    this.render([]);
  }

  async onClose(): Promise<void> {
    this.containerEl.empty();
  }

  /**
   * Render the full sidebar with the given thread list.
   * Clears the container and rebuilds from scratch.
   */
  render(threads: AgentThread[], handlers?: ThreadActionHandlers): void {
    this.threads = threads;
    this.containerEl.empty();

    const sidebar = this.containerEl.createDiv({ cls: 'agent-comments-sidebar' });

    // Header
    const header = sidebar.createDiv({ cls: 'sidebar-header' });
    header.createSpan({ text: 'Agent Comments' });
    const countBadge = header.createSpan({
      text: threads.length > 0 ? `${threads.length}` : '',
      cls: 'sidebar-count',
    });
    if (threads.length === 0) countBadge.hide();

    // Thread list
    const threadsContainer = sidebar.createDiv({ cls: 'sidebar-threads' });

    if (threads.length === 0) {
      const empty = threadsContainer.createDiv({ cls: 'sidebar-empty' });
      empty.createDiv({ cls: 'empty-icon', text: '💬' });
      empty.createDiv({ text: 'No comments yet' });
      empty.createDiv({
        text: 'Select text in the editor and run "Add Agent Comment"',
        cls: 'empty-hint',
      });
      return;
    }

    // Sort threads: responded/pending first, then by updatedAt desc
    const sorted = [...threads].sort((a, b) => {
      const priority = (s: string) =>
        s === 'responded' ? 0 : s === 'pending' || s === 'processing' ? 1 : 2;
      const pd = priority(a.status) - priority(b.status);
      if (pd !== 0) return pd;
      return b.updatedAt.localeCompare(a.updatedAt);
    });

    for (const thread of sorted) {
      this.renderThreadCard(threadsContainer, thread, handlers);
    }
  }

  /**
   * Render a single thread card with expand/collapse.
   */
  renderThreadCard(
    container: HTMLElement,
    thread: AgentThread,
    handlers?: ThreadActionHandlers
  ): void {
    const card = container.createDiv({ cls: 'agent-thread-card' });
    let expanded = false;

    // Header row (always visible)
    const header = card.createDiv({ cls: 'card-header' });

    const meta = header.createDiv({ cls: 'card-meta' });

    // Anchor quote
    const quote = thread.anchor.quote;
    meta.createDiv({
      cls: 'card-anchor-quote',
      text: quote.length > 60 ? quote.slice(0, 60) + '…' : quote,
    });

    // First message preview
    const firstMsg = thread.messages[0];
    if (firstMsg) {
      const preview = firstMsg.body;
      meta.createDiv({
        cls: 'card-preview',
        text: preview.length > 80 ? preview.slice(0, 80) + '…' : preview,
      });
    }

    // Footer: status badge + provider + timestamp
    const footer = meta.createDiv({ cls: 'card-footer' });

    footer.createSpan({
      cls: `thread-status-badge status-${thread.status}`,
      text: thread.status.replace('_', ' '),
    });

    if (thread.provider) {
      footer.createSpan({ cls: 'card-provider', text: thread.provider });
    }

    footer.createSpan({
      cls: 'card-timestamp',
      text: this.formatDate(thread.updatedAt),
    });

    // Toggle icon
    const toggleIcon = header.createSpan({ cls: 'card-toggle', text: '▶' });

    // Expanded body (hidden by default)
    const body = card.createDiv({ cls: 'card-body' });
    body.style.display = 'none';

    // Messages
    const messagesEl = body.createDiv({ cls: 'thread-messages' });
    for (const msg of thread.messages) {
      const isAgent = msg.author.startsWith('agent:');
      const msgEl = messagesEl.createDiv({
        cls: `thread-message${isAgent ? ' is-agent' : ''}`,
      });
      msgEl.createDiv({
        cls: 'message-author',
        text: isAgent ? msg.author.replace('agent:', '') : 'You',
      });
      msgEl.createDiv({ cls: 'message-body', text: msg.body });
    }

    // Patch diff if present
    if (thread.suggestedPatch) {
      const patch = thread.suggestedPatch;
      const diffBlock = body.createDiv({ cls: 'patch-diff-block' });

      const oldBlock = diffBlock.createDiv({ cls: 'patch-old-text' });
      oldBlock.createDiv({ cls: 'diff-label', text: 'Before' });
      oldBlock.createDiv({ cls: 'diff-content', text: patch.oldText });

      const newBlock = diffBlock.createDiv({ cls: 'patch-new-text' });
      newBlock.createDiv({ cls: 'diff-label', text: 'After' });
      newBlock.createDiv({ cls: 'diff-content', text: patch.newText });
    }

    // Action buttons
    const actionsEl = body.createDiv({ cls: 'thread-actions' });

    if (thread.status === 'responded' && thread.suggestedPatch) {
      const acceptBtn = actionsEl.createEl('button', {
        cls: 'thread-action-btn is-primary',
        text: 'Accept Patch',
      });
      acceptBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (handlers?.onAccept) await handlers.onAccept(thread.id);
      });

      const rejectBtn = actionsEl.createEl('button', {
        cls: 'thread-action-btn is-danger',
        text: 'Reject Patch',
      });
      rejectBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (handlers?.onReject) await handlers.onReject(thread.id);
      });
    }

    if (!['resolved', 'rejected'].includes(thread.status)) {
      const resolveBtn = actionsEl.createEl('button', {
        cls: 'thread-action-btn',
        text: 'Resolve',
      });
      resolveBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (handlers?.onResolve) await handlers.onResolve(thread.id);
      });
    }

    // Toggle expand/collapse on header click
    header.addEventListener('click', () => {
      expanded = !expanded;
      body.style.display = expanded ? 'block' : 'none';
      toggleIcon.textContent = expanded ? '▼' : '▶';
      card.toggleClass('is-expanded', expanded);
    });
  }

  private formatDate(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }
}
