import { validateProviderResponse } from '../src/validation';
import { createThread, transitionThread } from '../src/thread-lifecycle';
import type { AgentThread, AnchorData } from '../src/types';

const ANCHOR: AnchorData = {
  quote: 'sample text',
  prefix: '',
  suffix: '',
  startOffset: 0,
  endOffset: 11,
  headingPath: [],
  blockId: null,
  contentHash: 'abc',
};

function makePendingThread(): AgentThread {
  const t = createThread({
    id: 'thread_val_001',
    file: 'note.md',
    anchor: ANCHOR,
    initialMessage: '@Steve check this',
  });
  return transitionThread(t, 'pending', 'user');
}

function validResponse(thread: AgentThread, overrides: Record<string, unknown> = {}) {
  return {
    threadId: thread.id,
    status: 'responded',
    message: {
      id: 'msg_r1',
      author: `agent:${thread.provider}`,
      body: 'Looks good.',
      createdAt: new Date().toISOString(),
    },
    suggestedPatch: null,
    metadata: { provider: thread.provider },
    ...overrides,
  };
}

describe('validateProviderResponse', () => {
  it('accepts a well-formed response', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(validResponse(thread), thread);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts a response with status "error"', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      validResponse(thread, { status: 'error' }),
      thread
    );
    expect(result.valid).toBe(true);
  });

  it('accepts a response with a valid suggestedPatch', () => {
    const thread = makePendingThread();
    const patch = {
      type: 'replace',
      anchorId: thread.id,
      oldText: 'sample text',
      newText: 'improved text',
    };
    const result = validateProviderResponse(
      validResponse(thread, { suggestedPatch: patch }),
      thread
    );
    expect(result.valid).toBe(true);
  });

  it('rejects a non-object response', () => {
    const thread = makePendingThread();
    expect(validateProviderResponse(null, thread).valid).toBe(false);
    expect(validateProviderResponse('string', thread).valid).toBe(false);
    expect(validateProviderResponse(42, thread).valid).toBe(false);
  });

  it('rejects when threadId does not match', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      validResponse(thread, { threadId: 'thread_wrong_id' }),
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/threadId/);
  });

  it('rejects when metadata.provider does not match thread.provider', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      { ...validResponse(thread), metadata: { provider: 'codex' } },
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/metadata\.provider/);
  });

  it('rejects missing metadata', () => {
    const thread = makePendingThread();
    const r = validResponse(thread) as Record<string, unknown>;
    delete r.metadata;
    expect(validateProviderResponse(r, thread).valid).toBe(false);
  });

  it('rejects invalid status values', () => {
    const thread = makePendingThread();
    for (const bad of ['pending', 'processing', 'accepted', 'open', '', 42]) {
      const result = validateProviderResponse(
        validResponse(thread, { status: bad }),
        thread
      );
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/status/);
    }
  });

  it('rejects when message is missing', () => {
    const thread = makePendingThread();
    const r = validResponse(thread) as Record<string, unknown>;
    delete r.message;
    expect(validateProviderResponse(r, thread).valid).toBe(false);
  });

  it('rejects when message.body is not a string', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      { ...validResponse(thread), message: { author: 'agent:hermes', body: 42, createdAt: '' } },
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/message\.body/);
  });

  it('rejects when message.body exceeds 200k characters', () => {
    const thread = makePendingThread();
    const hugebody = 'x'.repeat(200_001);
    const result = validateProviderResponse(
      {
        ...validResponse(thread),
        message: { id: 'x', author: `agent:${thread.provider}`, body: hugebody, createdAt: '' },
      },
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/200000/);
  });

  it('rejects when message.author does not start with "agent:"', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      {
        ...validResponse(thread),
        message: { id: 'x', author: 'user', body: 'hi', createdAt: '' },
      },
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/agent:/);
  });

  it('rejects suggestedPatch with wrong type', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      validResponse(thread, {
        suggestedPatch: { type: 'insert', anchorId: thread.id, oldText: 'a', newText: 'b' },
      }),
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/type/);
  });

  it('rejects suggestedPatch with mismatched anchorId', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      validResponse(thread, {
        suggestedPatch: { type: 'replace', anchorId: 'thread_wrong', oldText: 'a', newText: 'b' },
      }),
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/anchorId/);
  });

  it('rejects suggestedPatch with non-string oldText', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      validResponse(thread, {
        suggestedPatch: { type: 'replace', anchorId: thread.id, oldText: 123, newText: 'b' },
      }),
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/oldText/);
  });

  it('rejects suggestedPatch.oldText exceeding 200k characters', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      validResponse(thread, {
        suggestedPatch: {
          type: 'replace',
          anchorId: thread.id,
          oldText: 'x'.repeat(200_001),
          newText: 'b',
        },
      }),
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/oldText/);
  });

  it('rejects suggestedPatch.newText exceeding 200k characters', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      validResponse(thread, {
        suggestedPatch: {
          type: 'replace',
          anchorId: thread.id,
          oldText: 'original',
          newText: 'x'.repeat(200_001),
        },
      }),
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/newText/);
  });

  it('rejects when suggestedPatch is a non-object non-null value', () => {
    const thread = makePendingThread();
    const result = validateProviderResponse(
      validResponse(thread, { suggestedPatch: 'not-a-patch' }),
      thread
    );
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/suggestedPatch/);
  });
});
