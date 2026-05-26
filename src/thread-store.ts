/**
 * Thread persistence layer using Obsidian's vault adapter.
 * Reads and writes thread JSON files under the configured thread directory.
 */

import type { Vault } from 'obsidian';
import type { AgentThread } from './types';

export class ThreadStore {
  private vault: Vault;
  private threadDir: string;

  constructor(vault: Vault, threadDir: string) {
    this.vault = vault;
    this.threadDir = threadDir;
  }

  /** Ensure the thread storage directory exists. */
  async ensureDir(): Promise<void> {
    const exists = await this.vault.adapter.exists(this.threadDir);
    if (!exists) {
      await this.vault.adapter.mkdir(this.threadDir);
    }
  }

  /** Persist a thread to disk as thread_<id>.json */
  async saveThread(thread: AgentThread): Promise<void> {
    await this.ensureDir();
    const filePath = this.threadFilePath(thread.id);
    await this.vault.adapter.write(filePath, JSON.stringify(thread, null, 2));
  }

  /** Load a thread by ID. Returns null if not found. */
  async loadThread(id: string): Promise<AgentThread | null> {
    const filePath = this.threadFilePath(id);
    try {
      const exists = await this.vault.adapter.exists(filePath);
      if (!exists) return null;
      const raw = await this.vault.adapter.read(filePath);
      return JSON.parse(raw) as AgentThread;
    } catch {
      return null;
    }
  }

  /** List all threads associated with a given file path. */
  async listThreadsForFile(filePath: string): Promise<AgentThread[]> {
    const all = await this.listAllThreads();
    return all.filter(t => t.file === filePath);
  }

  /** Load all threads from the thread directory. */
  async listAllThreads(): Promise<AgentThread[]> {
    try {
      const exists = await this.vault.adapter.exists(this.threadDir);
      if (!exists) return [];

      const listing = await this.vault.adapter.list(this.threadDir);
      const threads: AgentThread[] = [];

      for (const file of listing.files) {
        if (!file.endsWith('.json')) continue;
        try {
          const raw = await this.vault.adapter.read(file);
          const thread = JSON.parse(raw) as AgentThread;
          threads.push(thread);
        } catch {
          // Skip malformed files silently
        }
      }

      return threads;
    } catch {
      return [];
    }
  }

  /** Delete a thread file by ID. */
  async deleteThread(id: string): Promise<void> {
    const filePath = this.threadFilePath(id);
    try {
      const exists = await this.vault.adapter.exists(filePath);
      if (exists) {
        await this.vault.adapter.remove(filePath);
      }
    } catch {
      // Ignore deletion errors
    }
  }

  /** Generate a unique thread ID. */
  generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private threadFilePath(id: string): string {
    // id already carries the "thread_" prefix from generateThreadId(); use it verbatim.
    return `${this.threadDir.replace(/\/$/, '')}/${id}.json`;
  }
}
