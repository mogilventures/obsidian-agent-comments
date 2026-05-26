/**
 * Thread lifecycle management — state machine, creation, and mutation helpers.
 * Zero Obsidian imports — pure TypeScript logic.
 */

import type { AgentThread, AgentMessage, AnchorData, AuditEntry, ThreadStatus, ProviderResponse } from './types';
import { parseMentions } from './mention-parser';
import { routeThreadToProvider } from './provider-router';

/**
 * Valid status transitions in the thread state machine.
 * Keys are the "from" state; values are allowed "to" states.
 */
export const VALID_TRANSITIONS: Record<ThreadStatus, ThreadStatus[]> = {
  open:        ['pending', 'resolved'],
  // 'responded' is included because the file bridge skips the processing state:
  // the runner writes a complete response directly, so pending→responded is the
  // typical flow. pending→processing remains valid for runners that emit progress.
  pending:     ['processing', 'responded', 'error', 'lost_anchor'],
  processing:  ['responded', 'error', 'lost_anchor'],
  responded:   ['accepted', 'rejected', 'resolved', 'lost_anchor'],
  accepted:    ['resolved'],
  rejected:    ['resolved', 'pending'],
  resolved:    [],
  lost_anchor: ['open', 'resolved'],
  error:       ['pending', 'resolved'],
};

/**
 * Check whether a status transition is valid.
 */
export function canTransition(from: ThreadStatus, to: ThreadStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * All known provider IDs — used when creating threads before the user has
 * configured which providers are enabled.
 */
const ALL_PROVIDER_IDS = ['hermes', 'claude-code', 'codex'];

/**
 * Create a new AgentThread from the given parameters.
 * The thread starts in 'open' status; it transitions to 'pending' when the
 * user confirms and submits the comment.
 */
export function createThread(params: {
  id: string;
  file: string;
  anchor: AnchorData;
  initialMessage: string;
}): AgentThread {
  const now = new Date().toISOString();

  const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const initialMsg: AgentMessage = {
    id: messageId,
    author: 'user',
    body: params.initialMessage,
    createdAt: now,
  };

  const mentions = parseMentions(params.initialMessage);
  const provider = routeThreadToProvider(mentions, ALL_PROVIDER_IDS);

  const thread: AgentThread = {
    id: params.id,
    schemaVersion: 1,
    status: 'open',
    file: params.file,
    createdAt: now,
    updatedAt: now,
    anchor: params.anchor,
    messages: [initialMsg],
    mentions,
    provider,
    suggestedPatch: null,
    audit: [],
  };

  return thread;
}

/**
 * Append an audit entry to a thread, returning a new thread object (immutable-style).
 */
export function addAuditEntry(
  thread: AgentThread,
  action: string,
  actor: string,
  detail?: string
): AgentThread {
  const entry: AuditEntry = {
    timestamp: new Date().toISOString(),
    action,
    actor,
    ...(detail !== undefined ? { detail } : {}),
  };

  return {
    ...thread,
    audit: [...thread.audit, entry],
  };
}

/**
 * Transition a thread to a new status.
 * Validates the transition, updates status + updatedAt, and appends an audit entry.
 *
 * @throws Error if the transition is not valid
 */
export function transitionThread(
  thread: AgentThread,
  newStatus: ThreadStatus,
  actor: string
): AgentThread {
  if (!canTransition(thread.status, newStatus)) {
    throw new Error(
      `Invalid thread status transition: ${thread.status} → ${newStatus} ` +
      `(allowed from ${thread.status}: [${VALID_TRANSITIONS[thread.status].join(', ')}])`
    );
  }

  const now = new Date().toISOString();

  const updated: AgentThread = {
    ...thread,
    status: newStatus,
    updatedAt: now,
  };

  return addAuditEntry(
    updated,
    'status_transition',
    actor,
    `${thread.status} → ${newStatus}`
  );
}

/**
 * Merge a ProviderResponse into a thread.
 *
 * Appends the agent message, applies any suggested patch, then transitions to
 * the status indicated by the response (typically 'responded' or 'error').
 * If the indicated transition is not valid from the current state, falls back
 * to 'error' if possible, otherwise leaves the status unchanged.
 */
export function mergeProviderResponse(
  thread: AgentThread,
  response: ProviderResponse
): AgentThread {
  let updated = addMessage(thread, {
    author: `agent:${response.metadata.provider}`,
    body: response.message.body,
    createdAt: response.message.createdAt,
  });

  if (response.suggestedPatch) {
    updated = { ...updated, suggestedPatch: response.suggestedPatch };
  }

  const targetStatus: ThreadStatus =
    response.status === 'error' ? 'error' : 'responded';

  if (canTransition(updated.status, targetStatus)) {
    updated = transitionThread(
      updated,
      targetStatus,
      `agent:${response.metadata.provider}`
    );
  } else if (targetStatus !== 'error' && canTransition(updated.status, 'error')) {
    updated = transitionThread(updated, 'error', 'system');
  }

  return updated;
}

/**
 * Add a message to a thread.
 * Auto-generates a message ID, updates updatedAt, and re-parses mentions
 * across all messages to keep the mentions list current.
 */
export function addMessage(
  thread: AgentThread,
  message: Omit<AgentMessage, 'id'>
): AgentThread {
  const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const newMessage: AgentMessage = { id, ...message };

  const updatedMessages = [...thread.messages, newMessage];

  // Re-parse mentions from all message bodies
  const allText = updatedMessages.map(m => m.body).join(' ');
  const mentions = parseMentions(allText);

  const now = new Date().toISOString();

  return {
    ...thread,
    messages: updatedMessages,
    mentions,
    updatedAt: now,
  };
}
