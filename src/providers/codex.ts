/**
 * Codex provider adapter.
 *
 * Uses the shared file bridge for request/response handoff. The plugin writes a
 * request JSON to {bridgePath}/pending/ and polls {bridgePath}/complete/ for a
 * response.
 *
 * The plugin never invokes the Codex CLI directly. An out-of-process bridge
 * runner watches the pending directory, invokes Codex from within the configured
 * git working directory (Codex requires a git repo), passing thread context via
 * the request file (never shell-interpolated). The runner writes the structured
 * ProviderResponse to {bridgePath}/complete/.
 *
 * bridgePath should point to a directory within or adjacent to the git workdir.
 * Never use --yolo or equivalent flags in the bridge runner.
 *
 * See docs/provider-contract.md for the full bridge contract.
 */

import type { AgentProvider, AgentThread, ProviderResponse } from '../types';
import { writeBridgeRequest, readBridgeResponse } from './file-bridge';

export class CodexProvider implements AgentProvider {
  readonly id = 'codex';
  readonly displayName = 'Codex';

  private bridgePath: string;

  constructor(bridgePath: string) {
    this.bridgePath = bridgePath;
  }

  canHandleMention(mention: string): boolean {
    return mention.toLowerCase() === 'codex';
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
