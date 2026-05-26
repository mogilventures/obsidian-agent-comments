/**
 * Runtime validation for ProviderResponse objects received from bridge runners.
 * Zero Obsidian imports — pure TypeScript logic.
 */

import type { AgentThread } from './types';

const MAX_BODY_LENGTH = 200_000;
const MAX_PATCH_TEXT_LENGTH = 200_000;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate an incoming provider response against its expected thread.
 * Rejects responses with mismatched IDs, bad statuses, oversized fields,
 * or malformed patch shapes.
 */
export function validateProviderResponse(
  response: unknown,
  thread: AgentThread
): ValidationResult {
  if (typeof response !== 'object' || response === null) {
    return { valid: false, error: 'response is not an object' };
  }

  const r = response as Record<string, unknown>;

  if (r.threadId !== thread.id) {
    return {
      valid: false,
      error: `threadId mismatch: expected "${thread.id}", got "${r.threadId}"`,
    };
  }

  if (typeof r.metadata !== 'object' || r.metadata === null) {
    return { valid: false, error: 'metadata is missing or not an object' };
  }

  const meta = r.metadata as Record<string, unknown>;
  if (meta.provider !== thread.provider) {
    return {
      valid: false,
      error: `metadata.provider mismatch: expected "${thread.provider}", got "${meta.provider}"`,
    };
  }

  if (r.status !== 'responded' && r.status !== 'error') {
    return {
      valid: false,
      error: `status must be "responded" or "error", got "${r.status}"`,
    };
  }

  if (typeof r.message !== 'object' || r.message === null) {
    return { valid: false, error: 'message is missing or not an object' };
  }

  const msg = r.message as Record<string, unknown>;

  if (typeof msg.body !== 'string') {
    return { valid: false, error: 'message.body must be a string' };
  }

  if (msg.body.length > MAX_BODY_LENGTH) {
    return {
      valid: false,
      error: `message.body exceeds ${MAX_BODY_LENGTH} character limit`,
    };
  }

  if (typeof msg.author !== 'string' || !msg.author.startsWith('agent:')) {
    return {
      valid: false,
      error: `message.author must be a string starting with "agent:", got "${msg.author}"`,
    };
  }

  if (r.suggestedPatch !== null && r.suggestedPatch !== undefined) {
    if (typeof r.suggestedPatch !== 'object') {
      return { valid: false, error: 'suggestedPatch must be null or an object' };
    }

    const patch = r.suggestedPatch as Record<string, unknown>;

    if (patch.type !== 'replace') {
      return {
        valid: false,
        error: `suggestedPatch.type must be "replace", got "${patch.type}"`,
      };
    }

    if (patch.anchorId !== thread.id) {
      return {
        valid: false,
        error: `suggestedPatch.anchorId must match thread.id "${thread.id}"`,
      };
    }

    if (typeof patch.oldText !== 'string') {
      return { valid: false, error: 'suggestedPatch.oldText must be a string' };
    }

    if (typeof patch.newText !== 'string') {
      return { valid: false, error: 'suggestedPatch.newText must be a string' };
    }

    if ((patch.oldText as string).length > MAX_PATCH_TEXT_LENGTH) {
      return {
        valid: false,
        error: `suggestedPatch.oldText exceeds ${MAX_PATCH_TEXT_LENGTH} character limit`,
      };
    }

    if ((patch.newText as string).length > MAX_PATCH_TEXT_LENGTH) {
      return {
        valid: false,
        error: `suggestedPatch.newText exceeds ${MAX_PATCH_TEXT_LENGTH} character limit`,
      };
    }
  }

  return { valid: true };
}
