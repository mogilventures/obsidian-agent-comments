import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { writeBridgeRequest, readBridgeResponse } from '../src/providers/file-bridge';
import { createThread } from '../src/thread-lifecycle';
import type { ProviderResponse } from '../src/types';

const SAMPLE_ANCHOR = {
  quote: 'bridge test text',
  prefix: '',
  suffix: '',
  startOffset: 0,
  endOffset: 16,
  headingPath: [],
  blockId: null,
  contentHash: 'abc',
};

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bridge-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('writeBridgeRequest', () => {
  it('creates pending directory if it does not exist', async () => {
    const thread = createThread({
      id: 'thread_br_001',
      file: 'note.md',
      anchor: SAMPLE_ANCHOR,
      initialMessage: 'check this',
    });

    await writeBridgeRequest(thread, tmpDir);

    const stat = await fs.stat(path.join(tmpDir, 'pending'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('writes the file at pending/<threadId>.json (no double prefix)', async () => {
    const thread = createThread({
      id: 'thread_br_002',
      file: 'note.md',
      anchor: SAMPLE_ANCHOR,
      initialMessage: 'check this',
    });

    await writeBridgeRequest(thread, tmpDir);

    const expectedPath = path.join(tmpDir, 'pending', 'thread_br_002.json');
    const raw = await fs.readFile(expectedPath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.id).toBe('thread_br_002');
  });

  it('does not leave a .tmp file after a successful write', async () => {
    const thread = createThread({
      id: 'thread_br_003',
      file: 'note.md',
      anchor: SAMPLE_ANCHOR,
      initialMessage: 'atomic?',
    });

    await writeBridgeRequest(thread, tmpDir);

    const pending = path.join(tmpDir, 'pending');
    const files = await fs.readdir(pending);
    const tmpFiles = files.filter(f => f.endsWith('.tmp'));
    expect(tmpFiles).toHaveLength(0);
  });

  it('written JSON is valid and contains all required thread fields', async () => {
    const thread = createThread({
      id: 'thread_br_004',
      file: 'project/note.md',
      anchor: SAMPLE_ANCHOR,
      initialMessage: '@Steve please review this',
    });

    await writeBridgeRequest(thread, tmpDir);

    const raw = await fs.readFile(path.join(tmpDir, 'pending', 'thread_br_004.json'), 'utf-8');
    const parsed = JSON.parse(raw);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.status).toBe('open');
    expect(parsed.file).toBe('project/note.md');
    expect(Array.isArray(parsed.messages)).toBe(true);
    expect(parsed.messages[0].body).toBe('@Steve please review this');
  });

  it('overwrites an existing bridge file on re-submit', async () => {
    const thread = createThread({
      id: 'thread_br_005',
      file: 'note.md',
      anchor: SAMPLE_ANCHOR,
      initialMessage: 'first',
    });

    await writeBridgeRequest(thread, tmpDir);

    const updated = { ...thread, messages: [...thread.messages, { id: 'msg_x', author: 'user', body: 'second', createdAt: new Date().toISOString() }] };
    await writeBridgeRequest(updated, tmpDir);

    const raw = await fs.readFile(path.join(tmpDir, 'pending', 'thread_br_005.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.messages).toHaveLength(2);
  });
});

describe('readBridgeResponse', () => {
  it('returns null when no response file exists', async () => {
    const result = await readBridgeResponse('thread_missing', tmpDir);
    expect(result).toBeNull();
  });

  it('returns parsed ProviderResponse when file exists', async () => {
    const completeDir = path.join(tmpDir, 'complete');
    await fs.mkdir(completeDir, { recursive: true });

    const response: ProviderResponse = {
      threadId: 'thread_resp_001',
      status: 'responded',
      message: {
        id: 'msg_agent_1',
        author: 'agent:hermes',
        body: 'Here is my response.',
        createdAt: new Date().toISOString(),
      },
      suggestedPatch: null,
      metadata: { provider: 'hermes', model: 'hermes-2', durationMs: 1200 },
    };

    await fs.writeFile(
      path.join(completeDir, 'thread_resp_001.json'),
      JSON.stringify(response, null, 2),
      'utf-8'
    );

    const result = await readBridgeResponse('thread_resp_001', tmpDir);
    expect(result).not.toBeNull();
    expect(result!.threadId).toBe('thread_resp_001');
    expect(result!.message.body).toBe('Here is my response.');
    expect(result!.metadata.provider).toBe('hermes');
  });

  it('returns null for malformed JSON in response file', async () => {
    const completeDir = path.join(tmpDir, 'complete');
    await fs.mkdir(completeDir, { recursive: true });
    await fs.writeFile(
      path.join(completeDir, 'thread_bad.json'),
      '{ not valid json',
      'utf-8'
    );

    const result = await readBridgeResponse('thread_bad', tmpDir);
    expect(result).toBeNull();
  });
});

describe('end-to-end bridge flow', () => {
  it('write request then read response simulates the full bridge cycle', async () => {
    const thread = createThread({
      id: 'thread_e2e_001',
      file: 'story.md',
      anchor: SAMPLE_ANCHOR,
      initialMessage: '@Hermes improve this paragraph',
    });

    // Plugin writes request
    await writeBridgeRequest(thread, tmpDir);

    // External runner writes response (simulated)
    const completeDir = path.join(tmpDir, 'complete');
    await fs.mkdir(completeDir, { recursive: true });
    const response: ProviderResponse = {
      threadId: thread.id,
      status: 'responded',
      message: {
        id: 'msg_h_1',
        author: 'agent:hermes',
        body: 'I suggest tightening the opening sentence.',
        createdAt: new Date().toISOString(),
      },
      suggestedPatch: {
        type: 'replace',
        anchorId: thread.id,
        oldText: 'bridge test text',
        newText: 'bridge test text — improved',
      },
      metadata: { provider: 'hermes' },
    };
    await fs.writeFile(
      path.join(completeDir, `${thread.id}.json`),
      JSON.stringify(response, null, 2),
      'utf-8'
    );

    // Plugin polls
    const polled = await readBridgeResponse(thread.id, tmpDir);
    expect(polled).not.toBeNull();
    expect(polled!.suggestedPatch?.newText).toBe('bridge test text — improved');
  });
});
