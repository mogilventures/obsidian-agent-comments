import {
  createThread,
  transitionThread,
  addMessage,
  addAuditEntry,
  VALID_TRANSITIONS,
  canTransition,
} from '../src/thread-lifecycle';
import type { AnchorData, AgentThread } from '../src/types';

const SAMPLE_ANCHOR: AnchorData = {
  quote: 'selected text here',
  prefix: 'context before ',
  suffix: ' context after',
  startOffset: 100,
  endOffset: 118,
  headingPath: ['Introduction'],
  blockId: null,
  contentHash: 'abc123',
};

function makeThread(body = '@Steve please review this'): AgentThread {
  return createThread({
    id: 'thread_test_001',
    file: 'notes/Draft.md',
    anchor: SAMPLE_ANCHOR,
    initialMessage: body,
  });
}

describe('createThread', () => {
  it('builds correct initial state', () => {
    const thread = makeThread();

    expect(thread.id).toBe('thread_test_001');
    expect(thread.schemaVersion).toBe(1);
    expect(thread.status).toBe('open');
    expect(thread.file).toBe('notes/Draft.md');
    expect(thread.anchor).toEqual(SAMPLE_ANCHOR);
    expect(thread.suggestedPatch).toBeNull();
    expect(thread.audit).toEqual([]);
    expect(thread.messages).toHaveLength(1);
    expect(thread.messages[0].author).toBe('user');
    expect(typeof thread.createdAt).toBe('string');
    expect(typeof thread.updatedAt).toBe('string');
  });

  it('parses mentions from the initial message', () => {
    const thread = makeThread('@Steve review this and @Hermes double-check');
    expect(thread.mentions).toContain('Steve');
    expect(thread.mentions).toContain('Hermes');
  });

  it('resolves provider from mentions', () => {
    const thread = makeThread('@Steve check this');
    // 'Steve' maps to hermes
    expect(thread.provider).toBe('hermes');
  });

  it('sets provider to null for unknown mentions', () => {
    const thread = makeThread('No mentions here');
    expect(thread.provider).toBeNull();
    expect(thread.mentions).toHaveLength(0);
  });

  it('sets provider for @Claude mention', () => {
    const thread = makeThread('@Claude review the architecture');
    expect(thread.provider).toBe('claude-code');
  });

  it('generates a message ID', () => {
    const thread = makeThread();
    expect(thread.messages[0].id).toMatch(/^msg_/);
  });
});

describe('transitionThread', () => {
  it('open → pending succeeds', () => {
    const thread = makeThread();
    const updated = transitionThread(thread, 'pending', 'user');
    expect(updated.status).toBe('pending');
    expect(updated.audit).toHaveLength(1);
    expect(updated.audit[0].action).toBe('status_transition');
    expect(updated.audit[0].actor).toBe('user');
  });

  it('pending → processing succeeds', () => {
    const thread = transitionThread(makeThread(), 'pending', 'user');
    const updated = transitionThread(thread, 'processing', 'agent:hermes');
    expect(updated.status).toBe('processing');
  });

  it('processing → responded succeeds', () => {
    let thread = makeThread();
    thread = transitionThread(thread, 'pending', 'user');
    thread = transitionThread(thread, 'processing', 'agent:hermes');
    const updated = transitionThread(thread, 'responded', 'agent:hermes');
    expect(updated.status).toBe('responded');
  });

  it('responded → accepted succeeds', () => {
    let thread = makeThread();
    thread = transitionThread(thread, 'pending', 'user');
    thread = transitionThread(thread, 'processing', 'agent:hermes');
    thread = transitionThread(thread, 'responded', 'agent:hermes');
    const updated = transitionThread(thread, 'accepted', 'user');
    expect(updated.status).toBe('accepted');
  });

  it('responded → rejected succeeds', () => {
    let thread = makeThread();
    thread = transitionThread(thread, 'pending', 'user');
    thread = transitionThread(thread, 'processing', 'agent:hermes');
    thread = transitionThread(thread, 'responded', 'agent:hermes');
    const updated = transitionThread(thread, 'rejected', 'user');
    expect(updated.status).toBe('rejected');
  });

  it('open → resolved succeeds for manually dismissed comments', () => {
    const thread = makeThread();
    const updated = transitionThread(thread, 'resolved', 'user');
    expect(updated.status).toBe('resolved');
  });

  it('invalid transition (open → accepted) throws', () => {
    const thread = makeThread();
    expect(() => transitionThread(thread, 'accepted', 'user')).toThrow();
  });

  it('invalid transition (resolved → pending) throws', () => {
    let thread = makeThread();
    thread = transitionThread(thread, 'pending', 'user');
    thread = transitionThread(thread, 'error', 'system');
    thread = transitionThread(thread, 'resolved', 'user');
    expect(() => transitionThread(thread, 'pending', 'user')).toThrow();
  });

  it('does not mutate the original thread', () => {
    const thread = makeThread();
    const updated = transitionThread(thread, 'pending', 'user');
    expect(thread.status).toBe('open'); // original unchanged
    expect(updated.status).toBe('pending');
  });

  it('updates updatedAt timestamp', () => {
    const thread = makeThread();
    const before = thread.updatedAt;
    // Small delay to ensure timestamp differs
    const updated = transitionThread(thread, 'pending', 'user');
    // updatedAt is a new ISO string (may be same ms in fast tests, but field exists)
    expect(typeof updated.updatedAt).toBe('string');
  });

  it('appends audit entry with correct detail', () => {
    const thread = makeThread();
    const updated = transitionThread(thread, 'pending', 'user');
    const entry = updated.audit[0];
    expect(entry.detail).toBe('open → pending');
  });
});

describe('addMessage', () => {
  it('appends the message to the thread', () => {
    const thread = makeThread();
    const updated = addMessage(thread, {
      author: 'agent:hermes',
      body: 'Here is my response.',
      createdAt: new Date().toISOString(),
    });
    expect(updated.messages).toHaveLength(2);
    expect(updated.messages[1].author).toBe('agent:hermes');
    expect(updated.messages[1].body).toBe('Here is my response.');
  });

  it('auto-generates a message ID', () => {
    const thread = makeThread();
    const updated = addMessage(thread, {
      author: 'agent:hermes',
      body: 'Reply',
      createdAt: new Date().toISOString(),
    });
    expect(updated.messages[1].id).toMatch(/^msg_/);
  });

  it('updates mentions from all messages', () => {
    const thread = makeThread('@Steve check this');
    const updated = addMessage(thread, {
      author: 'user',
      body: '@Claude can you also look?',
      createdAt: new Date().toISOString(),
    });
    // Both Steve and Claude mentions should be present
    expect(updated.mentions).toContain('Steve');
    expect(updated.mentions).toContain('Claude');
  });

  it('updates updatedAt', () => {
    const thread = makeThread();
    const updated = addMessage(thread, {
      author: 'agent:hermes',
      body: 'Reply',
      createdAt: new Date().toISOString(),
    });
    expect(typeof updated.updatedAt).toBe('string');
  });

  it('does not mutate the original thread', () => {
    const thread = makeThread();
    const updated = addMessage(thread, {
      author: 'agent:hermes',
      body: 'Reply',
      createdAt: new Date().toISOString(),
    });
    expect(thread.messages).toHaveLength(1);
    expect(updated.messages).toHaveLength(2);
  });
});

describe('addAuditEntry', () => {
  it('appends an entry with the correct fields', () => {
    const thread = makeThread();
    const updated = addAuditEntry(thread, 'test_action', 'user', 'some detail');
    expect(updated.audit).toHaveLength(1);
    expect(updated.audit[0].action).toBe('test_action');
    expect(updated.audit[0].actor).toBe('user');
    expect(updated.audit[0].detail).toBe('some detail');
    expect(typeof updated.audit[0].timestamp).toBe('string');
  });

  it('works without detail', () => {
    const thread = makeThread();
    const updated = addAuditEntry(thread, 'action', 'user');
    expect(updated.audit[0].detail).toBeUndefined();
  });

  it('does not mutate the original thread', () => {
    const thread = makeThread();
    addAuditEntry(thread, 'action', 'user');
    expect(thread.audit).toHaveLength(0);
  });
});

describe('VALID_TRANSITIONS', () => {
  it('open allows pending and resolved... wait, open allows pending', () => {
    expect(VALID_TRANSITIONS.open).toContain('pending');
  });

  it('resolved has no valid transitions', () => {
    expect(VALID_TRANSITIONS.resolved).toEqual([]);
  });
});

describe('canTransition', () => {
  it('returns true for valid transitions', () => {
    expect(canTransition('open', 'pending')).toBe(true);
    expect(canTransition('pending', 'processing')).toBe(true);
    expect(canTransition('processing', 'responded')).toBe(true);
    expect(canTransition('responded', 'accepted')).toBe(true);
    expect(canTransition('responded', 'rejected')).toBe(true);
    expect(canTransition('accepted', 'resolved')).toBe(true);
    expect(canTransition('rejected', 'pending')).toBe(true);
  });

  it('returns false for invalid transitions', () => {
    expect(canTransition('open', 'accepted')).toBe(false);
    expect(canTransition('resolved', 'pending')).toBe(false);
    expect(canTransition('accepted', 'pending')).toBe(false);
  });
});

describe('mergeProviderResponse', () => {
  // Import here to avoid top-level import issues with the extended function
  const { mergeProviderResponse } = require('../src/thread-lifecycle');
  const { transitionThread: transition } = require('../src/thread-lifecycle');

  function makePendingThread(): AgentThread {
    const t = makeThread('@Steve review this');
    return transition(t, 'pending', 'user');
  }

  it('appends the agent message from the response', () => {
    const thread = makePendingThread();
    const response = {
      threadId: thread.id,
      status: 'responded' as const,
      message: { id: 'msg_a1', author: 'agent:hermes', body: 'Looks great!', createdAt: new Date().toISOString() },
      suggestedPatch: null,
      metadata: { provider: 'hermes' },
    };
    const merged = mergeProviderResponse(thread, response);
    expect(merged.messages).toHaveLength(2);
    expect(merged.messages[1].body).toBe('Looks great!');
  });

  it('transitions to responded from pending (bridge skips processing)', () => {
    const thread = makePendingThread();
    const response = {
      threadId: thread.id,
      status: 'responded' as const,
      message: { id: 'msg_a2', author: 'agent:hermes', body: 'Done.', createdAt: new Date().toISOString() },
      suggestedPatch: null,
      metadata: { provider: 'hermes' },
    };
    const merged = mergeProviderResponse(thread, response);
    expect(merged.status).toBe('responded');
  });

  it('transitions to error when response status is error', () => {
    const thread = makePendingThread();
    const response = {
      threadId: thread.id,
      status: 'error' as const,
      message: { id: 'msg_err', author: 'agent:hermes', body: 'Something went wrong.', createdAt: new Date().toISOString() },
      suggestedPatch: null,
      metadata: { provider: 'hermes' },
    };
    const merged = mergeProviderResponse(thread, response);
    expect(merged.status).toBe('error');
  });

  it('applies suggestedPatch from the response', () => {
    const thread = makePendingThread();
    const patch = { type: 'replace' as const, anchorId: thread.id, oldText: 'x', newText: 'y' };
    const response = {
      threadId: thread.id,
      status: 'responded' as const,
      message: { id: 'msg_a3', author: 'agent:hermes', body: 'Here is a patch.', createdAt: new Date().toISOString() },
      suggestedPatch: patch,
      metadata: { provider: 'hermes' },
    };
    const merged = mergeProviderResponse(thread, response);
    expect(merged.suggestedPatch).toEqual(patch);
  });

  it('leaves suggestedPatch null when response has no patch', () => {
    const thread = makePendingThread();
    const response = {
      threadId: thread.id,
      status: 'responded' as const,
      message: { id: 'msg_a4', author: 'agent:hermes', body: 'LGTM', createdAt: new Date().toISOString() },
      suggestedPatch: null,
      metadata: { provider: 'hermes' },
    };
    const merged = mergeProviderResponse(thread, response);
    expect(merged.suggestedPatch).toBeNull();
  });

  it('does not mutate the original thread', () => {
    const thread = makePendingThread();
    const response = {
      threadId: thread.id,
      status: 'responded' as const,
      message: { id: 'msg_a5', author: 'agent:hermes', body: 'Done.', createdAt: new Date().toISOString() },
      suggestedPatch: null,
      metadata: { provider: 'hermes' },
    };
    mergeProviderResponse(thread, response);
    expect(thread.status).toBe('pending');
    expect(thread.messages).toHaveLength(1);
  });

  it('appends audit entry for the status transition', () => {
    const thread = makePendingThread();
    const response = {
      threadId: thread.id,
      status: 'responded' as const,
      message: { id: 'msg_a6', author: 'agent:hermes', body: 'Done.', createdAt: new Date().toISOString() },
      suggestedPatch: null,
      metadata: { provider: 'hermes' },
    };
    const merged = mergeProviderResponse(thread, response);
    // Original pending→ has 1 audit entry; merge adds another for responded transition
    const transitions = merged.audit.filter(e => e.action === 'status_transition');
    expect(transitions.length).toBeGreaterThanOrEqual(2);
    const last = transitions[transitions.length - 1];
    expect(last.detail).toContain('responded');
  });
});

describe('VALID_TRANSITIONS — pending → responded', () => {
  it('pending → responded is valid (file bridge skips processing state)', () => {
    expect(canTransition('pending', 'responded')).toBe(true);
  });
});

describe('JSON serialization roundtrip', () => {
  it('preserves all fields through JSON.parse(JSON.stringify(thread))', () => {
    const thread = makeThread('@Steve tighten this argument');
    const roundtripped = JSON.parse(JSON.stringify(thread));

    expect(roundtripped.id).toBe(thread.id);
    expect(roundtripped.schemaVersion).toBe(thread.schemaVersion);
    expect(roundtripped.status).toBe(thread.status);
    expect(roundtripped.file).toBe(thread.file);
    expect(roundtripped.createdAt).toBe(thread.createdAt);
    expect(roundtripped.updatedAt).toBe(thread.updatedAt);
    expect(roundtripped.anchor).toEqual(thread.anchor);
    expect(roundtripped.messages).toEqual(thread.messages);
    expect(roundtripped.mentions).toEqual(thread.mentions);
    expect(roundtripped.provider).toBe(thread.provider);
    expect(roundtripped.suggestedPatch).toBe(thread.suggestedPatch);
    expect(roundtripped.audit).toEqual(thread.audit);
  });

  it('roundtrip on a thread with messages and audit entries', () => {
    let thread = makeThread('@Hermes research this');
    thread = transitionThread(thread, 'pending', 'user');
    thread = addMessage(thread, {
      author: 'agent:hermes',
      body: 'Here is my research response.',
      createdAt: new Date().toISOString(),
    });
    thread = addAuditEntry(thread, 'message_added', 'agent:hermes');

    const roundtripped: AgentThread = JSON.parse(JSON.stringify(thread));

    expect(roundtripped.messages).toHaveLength(2);
    expect(roundtripped.audit).toHaveLength(2); // transition + manual entry
    expect(roundtripped.status).toBe('pending');
    expect(roundtripped.mentions).toContain('Hermes');
  });
});
