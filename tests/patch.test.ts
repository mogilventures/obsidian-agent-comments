import { validatePatch, applyPatch } from '../src/patch';
import type { SuggestedPatch } from '../src/types';

function makePatch(oldText: string, newText = 'REPLACED'): SuggestedPatch {
  return { type: 'replace', anchorId: 'thread_test', oldText, newText };
}

describe('validatePatch', () => {
  it('returns true when oldText appears exactly once', () => {
    expect(validatePatch(makePatch('hello'), 'say hello world')).toBe(true);
  });

  it('returns false when oldText is absent', () => {
    expect(validatePatch(makePatch('missing'), 'some content')).toBe(false);
  });

  it('returns false for duplicate oldText with no anchor', () => {
    expect(validatePatch(makePatch('dup'), 'dup foo dup')).toBe(false);
  });

  it('returns true for duplicate oldText when only one occurrence is near anchor', () => {
    // 'dup' at index 0 and at index 1010; anchor at 0, window [0, 503] covers only the first
    const content = 'dup' + 'x'.repeat(1007) + 'dup';
    expect(validatePatch(makePatch('dup'), content, 0)).toBe(true);
  });

  it('returns true when anchor is near the second occurrence', () => {
    // 'dup' at index 0 and at index 1010; anchor at 1010, window [510, 1513] covers only second
    const content = 'dup' + 'x'.repeat(1007) + 'dup';
    expect(validatePatch(makePatch('dup'), content, 1010)).toBe(true);
  });

  it('returns false when both occurrences fall within anchor window (ambiguous)', () => {
    // Both at 0 and 4 — anchor window of 500 covers both
    expect(validatePatch(makePatch('dup'), 'dup dup', 0)).toBe(false);
  });

  it('returns false for duplicate oldText when anchor is provided but both in window', () => {
    const content = 'dup foo dup';
    // Both occurrences within 500 chars of anchor 0
    expect(validatePatch(makePatch('dup'), content, 0)).toBe(false);
  });
});

describe('applyPatch', () => {
  it('replaces a single occurrence', () => {
    const result = applyPatch(makePatch('hello', 'hi'), 'say hello world');
    expect(result).toBe('say hi world');
  });

  it('preserves text around the replaced region', () => {
    const result = applyPatch(makePatch('world', 'earth'), 'hello world goodbye');
    expect(result).toBe('hello earth goodbye');
  });

  it('throws when oldText is not found', () => {
    expect(() => applyPatch(makePatch('nope'), 'some content')).toThrow(/not found/);
  });

  it('throws for duplicate oldText with no anchor', () => {
    expect(() => applyPatch(makePatch('dup', 'X'), 'dup foo dup')).toThrow(/anchor/i);
  });

  it('applies patch at the occurrence near anchor (first of two)', () => {
    // 'dup' at index 0 and index 1010; anchor at 0 → replace first
    const content = 'dup' + 'x'.repeat(1007) + 'dup';
    const result = applyPatch(makePatch('dup', 'NEW'), content, 0);
    expect(result).toBe('NEW' + 'x'.repeat(1007) + 'dup');
  });

  it('applies patch at the occurrence near anchor (second of two)', () => {
    // 'dup' at index 0 and index 1010; anchor at 1010 → replace second
    const content = 'dup' + 'x'.repeat(1007) + 'dup';
    const result = applyPatch(makePatch('dup', 'NEW'), content, 1010);
    expect(result).toBe('dup' + 'x'.repeat(1007) + 'NEW');
  });

  it('throws when both occurrences are within the anchor window (ambiguous)', () => {
    // Both 'dup' at 0 and 4 are within 500 chars of anchor 0
    expect(() => applyPatch(makePatch('dup', 'X'), 'dup dup', 0)).toThrow();
  });

  it('does not modify content outside the replaced region', () => {
    const before = 'prefix ';
    const after = ' suffix';
    const content = before + 'OLD' + after;
    const result = applyPatch(makePatch('OLD', 'NEW'), content);
    expect(result).toBe(before + 'NEW' + after);
  });
});
