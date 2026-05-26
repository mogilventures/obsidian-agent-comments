/**
 * Claude Code provider adapter.
 *
 * Uses the shared file bridge for request/response handoff. The plugin writes a
 * request JSON to {bridgePath}/pending/ and polls {bridgePath}/complete/ for a
 * response.
 *
 * The plugin never invokes the Claude CLI directly. An out-of-process bridge
 * runner watches the pending directory, invokes:
 *   claude -p "<system-prompt>" --allowedTools "" --model sonnet
 * with thread context passed via the request file (never shell-interpolated),
 * then writes the structured ProviderResponse to {bridgePath}/complete/.
 *
 * See docs/provider-contract.md for the full bridge contract.
 */

import type { AgentProvider, AgentThread, ProviderResponse } from '../types';
import { writeBridgeRequest, readBridgeResponse } from './file-bridge';

export class ClaudeCodeProvider implements AgentProvider {
  readonly id = 'claude-code';
  readonly displayName = 'Claude Code';

  private bridgePath: string;

  constructor(bridgePath: string) {
    this.bridgePath = bridgePath;
  }

  canHandleMention(mention: string): boolean {
    const lower = mention.toLowerCase();
    return lower === 'claude' || lower === 'claudecode';
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
