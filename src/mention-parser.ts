/**
 * Mention parsing utilities.
 * Zero Obsidian imports — pure TypeScript logic.
 */

/**
 * Mapping of lowercase mention tokens to provider IDs.
 * Keys are the lowercased form of what users type after @.
 */
export const KNOWN_MENTIONS: Record<string, string> = {
  steve: 'hermes',
  hermes: 'hermes',
  claude: 'claude-code',
  claudecode: 'claude-code',
  codex: 'codex',
};

/**
 * Extract all @Mention tokens from a string.
 * Deduplicates by lowercased value but preserves original casing of the
 * first occurrence of each unique mention.
 *
 * @param text - The input string to scan
 * @returns Array of mention tokens (without the @ prefix), preserving original casing
 */
export function parseMentions(text: string): string[] {
  const regex = /@(\w+)/g;
  const seen = new Set<string>();
  const results: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const token = match[1]; // original casing
    const lower = token.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      results.push(token);
    }
  }

  return results;
}

/**
 * Resolve a mention token to a provider ID.
 * Lookup is case-insensitive.
 *
 * @param mention - The mention token (without @)
 * @returns The provider ID, or null if the mention is not recognised
 */
export function mentionToProviderId(mention: string): string | null {
  const key = mention.toLowerCase();
  return KNOWN_MENTIONS[key] ?? null;
}
