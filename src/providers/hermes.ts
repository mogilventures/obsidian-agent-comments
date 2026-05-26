/**
 * Hermes provider adapter.
 *
 * Uses the shared file bridge for request/response handoff. The plugin writes a
 * request JSON to {bridgePath}/pending/ and polls {bridgePath}/complete/ for a
 * response written by the Hermes agent (running locally or on a VPS that syncs
 * via Obsidian Sync / cloud storage).
 *
 * The plugin never invokes the Hermes CLI directly. An out-of-process bridge
 * runner watches the pending directory and is responsible for calling Hermes and
 * writing the ProviderResponse. See docs/provider-contract.md.
 */

import type { AgentProvider, AgentThread, ProviderResponse } from '../types';
import { writeBridgeRequest, readBridgeResponse } from './file-bridge';

export class HermesProvider implements AgentProvider {
  readonly id = 'hermes';
  readonly displayName = 'Hermes';

  private bridgePath: string;

  constructor(bridgePath: string) {
    this.bridgePath = bridgePath;
  }

  canHandleMention(mention: string): boolean {
    const lower = mention.toLowerCase();
    return lower === 'steve' || lower === 'hermes';
  }

  /** Write request to {bridgePath}/pending/{thread.id}.json (atomic). */
  async submitThread(thread: AgentThread, _vaultPath: string): Promise<void> {
    await writeBridgeRequest(thread, this.bridgePath);
  }

  /** Return parsed ProviderResponse from {bridgePath}/complete/{threadId}.json, or null. */
  async pollThread(threadId: string): Promise<ProviderResponse | null> {
    return readBridgeResponse(threadId, this.bridgePath);
  }
}
