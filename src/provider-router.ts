/**
 * Provider routing logic.
 * Zero Obsidian imports — pure TypeScript logic.
 */

import { mentionToProviderId } from './mention-parser';

/**
 * Route a thread to a provider based on extracted @mentions and the set of
 * currently enabled provider IDs.
 *
 * Returns the first provider ID whose mention matches an enabled provider.
 * Returns null if no mentions are present, if no mentions resolve to a known
 * provider, or if the resolved provider is not in the enabled list.
 *
 * @param mentions - Array of @mention tokens (original casing, from parseMentions)
 * @param enabledProviders - Array of enabled provider ID strings
 * @returns The matched provider ID, or null
 */
export function routeThreadToProvider(
  mentions: string[],
  enabledProviders: string[]
): string | null {
  if (!mentions || mentions.length === 0) {
    return null;
  }

  for (const mention of mentions) {
    const providerId = mentionToProviderId(mention);
    if (providerId !== null && enabledProviders.includes(providerId)) {
      return providerId;
    }
  }

  return null;
}
