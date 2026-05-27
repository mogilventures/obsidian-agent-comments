/**
 * Patch validation and application utilities.
 * Zero Obsidian imports — pure TypeScript logic.
 *
 * Uses literal string operations rather than regex to avoid issues with special
 * characters in patch text.
 *
 * When the document contains multiple occurrences of oldText, an anchor offset
 * is required. The functions prefer the single occurrence that falls within
 * ANCHOR_WINDOW characters of the recorded anchor position. If two or more
 * occurrences fall within the window the operation is considered ambiguous and
 * rejected, preventing silent replacement of the wrong passage.
 */

import type { SuggestedPatch } from './types';

/** Search radius (chars) around the anchor offset used to disambiguate duplicates. */
const ANCHOR_WINDOW = 500;

function countOccurrences(content: string, text: string): number {
  let count = 0;
  let idx = 0;
  while ((idx = content.indexOf(text, idx)) !== -1) {
    count++;
    idx += text.length;
  }
  return count;
}

/**
 * Find the index of text within [anchorOffset - ANCHOR_WINDOW,
 * anchorOffset + text.length + ANCHOR_WINDOW). Returns -1 if zero or more than
 * one occurrence falls within that window (zero = not found; >1 = ambiguous).
 */
function findNearAnchor(content: string, text: string, anchorOffset: number): number {
  const windowStart = Math.max(0, anchorOffset - ANCHOR_WINDOW);
  const windowEnd = anchorOffset + text.length + ANCHOR_WINDOW;
  let found = -1;
  let idx = windowStart;
  while (idx < windowEnd) {
    const match = content.indexOf(text, idx);
    if (match === -1 || match >= windowEnd) break;
    if (found !== -1) return -1; // two matches in window — ambiguous
    found = match;
    idx = match + text.length;
  }
  return found;
}

/**
 * Check whether a patch's oldText can be unambiguously located in fileContent.
 *
 * - Exactly one occurrence anywhere → valid.
 * - Zero occurrences → invalid.
 * - Multiple occurrences, no anchor → invalid.
 * - Multiple occurrences with anchor → valid only if exactly one occurrence
 *   falls within ANCHOR_WINDOW of anchorStartOffset.
 */
export function validatePatch(
  patch: SuggestedPatch,
  fileContent: string,
  anchorStartOffset?: number
): boolean {
  const count = countOccurrences(fileContent, patch.oldText);
  if (count === 0) return false;
  if (count === 1) return true;
  if (anchorStartOffset === undefined) return false;
  return findNearAnchor(fileContent, patch.oldText, anchorStartOffset) !== -1;
}

/**
 * Apply a patch by replacing the unambiguous occurrence of oldText with newText.
 *
 * @throws Error if oldText is absent, appears multiple times without an anchor,
 *   or appears multiple times near the anchor (ambiguous).
 */
export function applyPatch(
  patch: SuggestedPatch,
  fileContent: string,
  anchorStartOffset?: number
): string {
  const count = countOccurrences(fileContent, patch.oldText);

  if (count === 0) {
    throw new Error(
      `Cannot apply patch: oldText not found. Starts with: "${patch.oldText.slice(0, 50)}"`
    );
  }

  let idx: number;

  if (count === 1) {
    idx = fileContent.indexOf(patch.oldText);
  } else {
    if (anchorStartOffset === undefined) {
      throw new Error(
        `Cannot apply patch: ${count} occurrences of oldText found and no anchor provided to disambiguate`
      );
    }
    idx = findNearAnchor(fileContent, patch.oldText, anchorStartOffset);
    if (idx === -1) {
      throw new Error(
        `Cannot apply patch: ${count} occurrences of oldText found, none unambiguously near anchor offset ${anchorStartOffset}`
      );
    }
  }

  return (
    fileContent.slice(0, idx) +
    patch.newText +
    fileContent.slice(idx + patch.oldText.length)
  );
}
