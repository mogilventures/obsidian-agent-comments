import { resolveQuoteToOffsets } from '../src/quote-anchor';

describe('resolveQuoteToOffsets', () => {
  it('returns unique offsets when the quote appears exactly once', () => {
    const content = 'The quick brown fox jumps over the lazy dog.';
    const result = resolveQuoteToOffsets(content, 'brown fox');
    expect(result).toEqual({ status: 'unique', startOffset: 10, endOffset: 19 });
    expect(content.slice(10, 19)).toBe('brown fox');
  });

  it('trims surrounding whitespace from the selected quote before searching', () => {
    const content = 'alpha beta gamma';
    const result = resolveQuoteToOffsets(content, '  beta \n');
    expect(result).toEqual({ status: 'unique', startOffset: 6, endOffset: 10 });
  });

  it('returns not-found when the quote is absent from the source', () => {
    expect(resolveQuoteToOffsets('hello world', 'missing')).toEqual({ status: 'not-found' });
  });

  it('returns not-found for an empty or whitespace-only quote', () => {
    expect(resolveQuoteToOffsets('hello world', '   ')).toEqual({ status: 'not-found' });
    expect(resolveQuoteToOffsets('hello world', '')).toEqual({ status: 'not-found' });
  });

  it('reports a duplicate match with its count and never picks one', () => {
    const result = resolveQuoteToOffsets('dup foo dup bar dup', 'dup');
    expect(result).toEqual({ status: 'duplicate', count: 3 });
  });

  it('treats a quote that occurs twice as ambiguous', () => {
    expect(resolveQuoteToOffsets('repeat me, repeat me', 'repeat me')).toEqual({
      status: 'duplicate',
      count: 2,
    });
  });
});
