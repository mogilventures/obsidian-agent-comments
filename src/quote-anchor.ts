/**
 * Resolve a selected quote (e.g. text selected in Reading View) to an exact
 * offset range in the Markdown source. Zero Obsidian imports — pure TypeScript.
 *
 * Rendered HTML in Reading View does not map cleanly back to Markdown source
 * offsets, so we fall back to an exact literal search of the selected text in
 * the source. The result is only usable when the quote occurs exactly once;
 * zero or multiple matches are reported so the caller can refuse to guess
 * rather than silently anchor to the wrong passage.
 */

/** Outcome of resolving a selected quote against the Markdown source. */
export type QuoteResolution =
  | { status: 'unique'; startOffset: number; endOffset: number }
  | { status: 'not-found' }
  | { status: 'duplicate'; count: number };

/**
 * Locate `quote` (after trimming surrounding whitespace) within `content`.
 *
 * - Exactly one occurrence → `unique` with start/end offsets.
 * - Zero occurrences (or empty quote) → `not-found`.
 * - Two or more occurrences → `duplicate` with the match count.
 *
 * Matching is exact and literal; overlapping matches are not counted because
 * the scan advances past each match by its full length.
 */
export function resolveQuoteToOffsets(content: string, quote: string): QuoteResolution {
  const needle = quote.trim();
  if (!needle) return { status: 'not-found' };

  let count = 0;
  let firstIdx = -1;
  let idx = 0;
  while ((idx = content.indexOf(needle, idx)) !== -1) {
    count++;
    if (firstIdx === -1) firstIdx = idx;
    idx += needle.length;
  }

  if (count === 0) return { status: 'not-found' };
  if (count > 1) return { status: 'duplicate', count };
  return { status: 'unique', startOffset: firstIdx, endOffset: firstIdx + needle.length };
}
