/**
 * Core type definitions for the Agent Comments plugin.
 * Zero Obsidian imports — all types are plain TypeScript.
 */

/** Thread lifecycle status */
export type ThreadStatus =
  | 'open'
  | 'pending'
  | 'processing'
  | 'responded'
  | 'accepted'
  | 'rejected'
  | 'resolved'
  | 'lost_anchor'
  | 'error';

/** Text anchor data for re-locating the commented range */
export interface AnchorData {
  /** The exact selected text */
  quote: string;
  /** Text immediately before the selection (context for re-anchoring) */
  prefix: string;
  /** Text immediately after the selection (context for re-anchoring) */
  suffix: string;
  /** Character offset of selection start at creation time */
  startOffset: number;
  /** Character offset of selection end at creation time */
  endOffset: number;
  /** Heading path breadcrumbs at time of creation, e.g. ["Section", "Subsection"] */
  headingPath: string[];
  /** Obsidian block ID if present, e.g. "^abc123" */
  blockId: string | null;
  /** MD5 or hash of file content at creation time for staleness detection */
  contentHash: string;
}

/** A single message within a thread */
export interface AgentMessage {
  /** Unique message ID */
  id: string;
  /** Author identifier: "user" or "agent:<providerId>" */
  author: string;
  /** Message body text (may contain @mentions) */
  body: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
}

/** A suggested text replacement patch */
export interface SuggestedPatch {
  /** Patch type — only 'replace' in MVP */
  type: 'replace';
  /** ID of the anchor this patch targets */
  anchorId: string;
  /** Exact text to find and replace */
  oldText: string;
  /** Replacement text */
  newText: string;
}

/** An audit log entry recording a lifecycle event */
export interface AuditEntry {
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Short action name, e.g. "status_transition", "message_added" */
  action: string;
  /** Actor identifier, e.g. "user", "agent:hermes" */
  actor: string;
  /** Optional free-form detail string */
  detail?: string;
}

/** The complete durable state of a comment thread */
export interface AgentThread {
  /** Unique thread ID */
  id: string;
  /** Schema version for forward-compatibility */
  schemaVersion: 1;
  /** Current lifecycle status */
  status: ThreadStatus;
  /** Vault-relative path of the file this thread belongs to */
  file: string;
  /** ISO 8601 creation timestamp */
  createdAt: string;
  /** ISO 8601 last-updated timestamp */
  updatedAt: string;
  /** Text anchor */
  anchor: AnchorData;
  /** Ordered list of messages */
  messages: AgentMessage[];
  /** Deduplicated list of @mention tokens extracted from all messages */
  mentions: string[];
  /** Resolved provider ID, e.g. "hermes", "claude-code", "codex", or null */
  provider: string | null;
  /** Suggested patch from the agent, or null */
  suggestedPatch: SuggestedPatch | null;
  /** Append-only audit log */
  audit: AuditEntry[];
}

/** Response shape written by provider bridges */
export interface ProviderResponse {
  /** ID of the thread being responded to */
  threadId: string;
  /** New status to transition to (typically "responded") */
  status: ThreadStatus;
  /** The agent's reply message */
  message: AgentMessage;
  /** Optional suggested patch */
  suggestedPatch: SuggestedPatch | null;
  /** Provider metadata */
  metadata: {
    provider: string;
    model?: string;
    durationMs?: number;
  };
}

/** Contract that all provider adapters must implement */
export interface AgentProvider {
  /** Unique provider identifier */
  id: string;
  /** Human-readable display name */
  displayName: string;
  /** Returns true if this provider can handle the given @mention token */
  canHandleMention(mention: string): boolean;
  /** Submit a thread for processing — writes request to bridge directory */
  submitThread(thread: AgentThread, vaultPath: string): Promise<void>;
  /** Poll for a completed response — returns null if not yet available */
  pollThread?(threadId: string): Promise<ProviderResponse | null>;
}

/** Per-provider configuration */
export interface ProviderSettings {
  /** Whether this provider is active */
  enabled: boolean;
  /** Path to the provider bridge directory for file-based handoff */
  bridgePath: string;
}

/** Top-level plugin settings */
export interface PluginSettings {
  /** Directory (absolute or vault-relative) where thread JSON files are stored */
  threadDirectory: string;
  /** Per-provider settings */
  providers: {
    hermes: ProviderSettings;
    claudeCode: ProviderSettings;
    codex: ProviderSettings;
  };
  /** User has acknowledged that note content may be shared with local/VPS agents */
  consentGiven: boolean;
}
