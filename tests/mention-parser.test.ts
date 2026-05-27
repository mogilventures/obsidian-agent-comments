import { parseMentions, mentionToProviderId, KNOWN_MENTIONS } from '../src/mention-parser';

describe('parseMentions', () => {
  it('extracts known mentions from text', () => {
    const result = parseMentions('@Steve review this and @Hermes also check it');
    expect(result).toContain('Steve');
    expect(result).toContain('Hermes');
  });

  it('extracts @Claude, @ClaudeCode, @Codex', () => {
    const result = parseMentions('@Claude look at this @ClaudeCode and @Codex too');
    expect(result).toContain('Claude');
    expect(result).toContain('ClaudeCode');
    expect(result).toContain('Codex');
  });

  it('returns empty array for text with no mentions', () => {
    expect(parseMentions('no mentions here')).toEqual([]);
    expect(parseMentions('')).toEqual([]);
    expect(parseMentions('hello world')).toEqual([]);
  });

  it('deduplicates repeated mentions (case-insensitive)', () => {
    const result = parseMentions('@Steve please review. @steve also look at this.');
    // 'Steve' and 'steve' are the same mention — only first occurrence kept
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Steve'); // first occurrence casing preserved
  });

  it('preserves original casing of the first occurrence', () => {
    const result = parseMentions('@HERMES check this and @hermes again');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('HERMES');
  });

  it('does not include @ symbol in returned tokens', () => {
    const result = parseMentions('@Steve @Claude');
    for (const m of result) {
      expect(m).not.toMatch(/^@/);
    }
  });

  it('handles mentions with adjacent punctuation', () => {
    const result = parseMentions('Hey @Steve, can you review this? Thanks @Claude!');
    expect(result).toContain('Steve');
    expect(result).toContain('Claude');
  });
});

describe('mentionToProviderId', () => {
  it('maps @Steve to hermes', () => {
    expect(mentionToProviderId('Steve')).toBe('hermes');
  });

  it('maps @Hermes to hermes', () => {
    expect(mentionToProviderId('Hermes')).toBe('hermes');
  });

  it('maps @Claude to claude-code', () => {
    expect(mentionToProviderId('Claude')).toBe('claude-code');
  });

  it('maps @ClaudeCode to claude-code', () => {
    expect(mentionToProviderId('ClaudeCode')).toBe('claude-code');
  });

  it('maps @Codex to codex', () => {
    expect(mentionToProviderId('Codex')).toBe('codex');
  });

  it('is case-insensitive', () => {
    expect(mentionToProviderId('STEVE')).toBe('hermes');
    expect(mentionToProviderId('steve')).toBe('hermes');
    expect(mentionToProviderId('CLAUDE')).toBe('claude-code');
    expect(mentionToProviderId('claudecode')).toBe('claude-code');
    expect(mentionToProviderId('CODEX')).toBe('codex');
  });

  it('returns null for unknown mentions', () => {
    expect(mentionToProviderId('Unknown')).toBeNull();
    expect(mentionToProviderId('GPT')).toBeNull();
    expect(mentionToProviderId('')).toBeNull();
    expect(mentionToProviderId('foo')).toBeNull();
  });
});

describe('KNOWN_MENTIONS', () => {
  it('has all expected keys in lowercase', () => {
    expect(KNOWN_MENTIONS['steve']).toBe('hermes');
    expect(KNOWN_MENTIONS['hermes']).toBe('hermes');
    expect(KNOWN_MENTIONS['claude']).toBe('claude-code');
    expect(KNOWN_MENTIONS['claudecode']).toBe('claude-code');
    expect(KNOWN_MENTIONS['codex']).toBe('codex');
  });
});
