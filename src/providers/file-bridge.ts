/**
 * Shared file-based bridge helper for all provider adapters.
 *
 * Bridge contract (see docs/provider-contract.md):
 *   Plugin writes:  {bridgePath}/pending/{threadId}.json
 *   Runner reads:   {bridgePath}/pending/{threadId}.json
 *   Runner writes:  {bridgePath}/complete/{threadId}.json
 *   Plugin reads:   {bridgePath}/complete/{threadId}.json
 *
 * Atomic write pattern: write <id>.tmp then rename to <id>.json so that the
 * external runner never sees a partial file. Falls back to a direct write if
 * rename fails (e.g. cross-device or Obsidian sandbox restrictions).
 *
 * The plugin never invokes agent CLIs (claude, codex, hermes) directly.
 * An out-of-process bridge runner watches the pending directory and is
 * responsible for invoking the CLI and writing the response.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { AgentThread, ProviderResponse } from '../types';

/**
 * Write a thread as a bridge request file with an atomic tmp→rename pattern.
 * Creates {bridgePath}/pending/ if it does not exist.
 */
export async function writeBridgeRequest(
  thread: AgentThread,
  bridgePath: string
): Promise<void> {
  const pendingDir = path.join(bridgePath, 'pending');
  await fs.mkdir(pendingDir, { recursive: true });

  const finalPath = path.join(pendingDir, `${thread.id}.json`);
  const tmpPath = path.join(pendingDir, `${thread.id}.tmp`);
  const content = JSON.stringify(thread, null, 2);

  await fs.writeFile(tmpPath, content, 'utf-8');
  try {
    await fs.rename(tmpPath, finalPath);
  } catch {
    // Cross-device rename not supported — fall back to direct write.
    await fs.writeFile(finalPath, content, 'utf-8');
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}

/**
 * Read a completed ProviderResponse from {bridgePath}/complete/{threadId}.json.
 * Returns null if the file does not exist yet (not yet processed).
 */
export async function readBridgeResponse(
  threadId: string,
  bridgePath: string
): Promise<ProviderResponse | null> {
  const completePath = path.join(bridgePath, 'complete', `${threadId}.json`);
  try {
    const raw = await fs.readFile(completePath, 'utf-8');
    return JSON.parse(raw) as ProviderResponse;
  } catch {
    return null;
  }
}
