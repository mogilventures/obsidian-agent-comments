import { ThreadStore } from '../src/thread-store';
import { createThread } from '../src/thread-lifecycle';
import type { AgentThread } from '../src/types';

const SAMPLE_ANCHOR = {
  quote: 'test text',
  prefix: '',
  suffix: '',
  startOffset: 0,
  endOffset: 9,
  headingPath: [],
  blockId: null,
  contentHash: 'abc',
};

function makeMockVault() {
  const store = new Map<string, string>();
  return {
    adapter: {
      exists: jest.fn(async (p: string) => store.has(p)),
      mkdir: jest.fn(async () => undefined),
      read: jest.fn(async (p: string) => {
        const v = store.get(p);
        if (v === undefined) throw new Error(`ENOENT: ${p}`);
        return v;
      }),
      write: jest.fn(async (p: string, data: string) => { store.set(p, data); }),
      remove: jest.fn(async (p: string) => { store.delete(p); }),
      list: jest.fn(async (dir: string) => {
        const prefix = dir.replace(/\/$/, '') + '/';
        const files = [...store.keys()].filter(
          k => k.startsWith(prefix) && !k.slice(prefix.length).includes('/')
        );
        return { files, folders: [] };
      }),
    },
    _store: store,
  };
}

describe('ThreadStore — thread file path (no double prefix)', () => {
  it('saves as <id>.json, not thread_<id>.json, when id starts with thread_', async () => {
    const vault = makeMockVault();
    const store = new ThreadStore(vault as any, 'threads');

    // generateThreadId returns "thread_<ts>_<rand>" — use a fixed id to be deterministic
    const thread = createThread({
      id: 'thread_abc123_xyz',
      file: 'note.md',
      anchor: SAMPLE_ANCHOR,
      initialMessage: 'test',
    });

    await store.saveThread(thread);

    const writtenPaths = [...vault._store.keys()];
    // Must contain exactly one .json file in threads/
    const jsonFiles = writtenPaths.filter(p => p.endsWith('.json'));
    expect(jsonFiles).toHaveLength(1);

    // The filename must be the id verbatim, not double-prefixed
    expect(jsonFiles[0]).toBe('threads/thread_abc123_xyz.json');
    expect(jsonFiles[0]).not.toContain('thread_thread_');
  });

  it('loadThread round-trips correctly with the fixed path', async () => {
    const vault = makeMockVault();
    const store = new ThreadStore(vault as any, 'threads');

    const thread = createThread({
      id: 'thread_round_001',
      file: 'note.md',
      anchor: SAMPLE_ANCHOR,
      initialMessage: 'hello',
    });

    await store.saveThread(thread);
    const loaded = await store.loadThread('thread_round_001');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('thread_round_001');
    expect(loaded!.status).toBe('open');
  });

  it('generateThreadId has thread_ prefix (so file path stays un-doubled)', () => {
    const vault = makeMockVault();
    const store = new ThreadStore(vault as any, 'threads');
    const id = store.generateThreadId();
    expect(id).toMatch(/^thread_/);
  });

  it('listAllThreads returns saved threads', async () => {
    const vault = makeMockVault();
    const store = new ThreadStore(vault as any, 'threads');

    // Manually seed the dir-exists check
    vault._store.set('threads', '__dir__');

    const t1 = createThread({ id: 'thread_t1', file: 'a.md', anchor: SAMPLE_ANCHOR, initialMessage: 'x' });
    const t2 = createThread({ id: 'thread_t2', file: 'b.md', anchor: SAMPLE_ANCHOR, initialMessage: 'y' });

    await store.saveThread(t1);
    await store.saveThread(t2);

    const all = await store.listAllThreads();
    expect(all).toHaveLength(2);
    const ids = all.map(t => t.id).sort();
    expect(ids).toEqual(['thread_t1', 'thread_t2']);
  });

  it('deleteThread removes the file', async () => {
    const vault = makeMockVault();
    const store = new ThreadStore(vault as any, 'threads');

    const thread = createThread({
      id: 'thread_del_001',
      file: 'note.md',
      anchor: SAMPLE_ANCHOR,
      initialMessage: 'bye',
    });

    await store.saveThread(thread);
    expect(vault._store.has('threads/thread_del_001.json')).toBe(true);

    await store.deleteThread('thread_del_001');
    expect(vault._store.has('threads/thread_del_001.json')).toBe(false);
  });
});
