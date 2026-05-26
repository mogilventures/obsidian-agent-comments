/**
 * CodeMirror 6 decoration extension for thread anchor highlights.
 *
 * This extension maintains a StateField<DecorationSet> that maps thread
 * anchor positions through editor transactions and rebuilds mark decorations
 * for anchors that can be located in the current document.
 *
 * @codemirror/* packages are externalized at build time (Obsidian provides
 * them at runtime). All imports are guarded so that the extension degrades
 * gracefully if CodeMirror is unavailable (e.g., in Jest tests).
 */

import type { AgentThread } from './types';

// Type-only imports — the actual modules are provided by Obsidian at runtime.
// We dynamically require them so that Jest tests (which mock @codemirror/*)
// can still import this file without breaking.
type Extension = any;

/**
 * Build a CodeMirror decoration extension that highlights thread anchors.
 *
 * @param getThreads - Callback returning the current list of threads to render
 * @returns A CodeMirror Extension (StateField), or an empty array if CM is unavailable
 */
export function buildDecorationExtension(getThreads: () => AgentThread[]): Extension {
  try {
    // Dynamically access the CodeMirror packages that Obsidian provides.
    // Using require() here so that this file can be safely imported in test
    // environments where @codemirror/* are mocked as empty objects.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { StateField } = require('@codemirror/state');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Decoration, EditorView } = require('@codemirror/view');

    if (!StateField || !Decoration || !EditorView) {
      return [];
    }

    const threadDecorationsField = StateField.define({
      create(): any {
        return Decoration.none;
      },

      update(decorations: any, transaction: any): any {
        try {
          // Map existing decorations through any document changes
          let mapped = decorations.map(transaction.changes);

          // Rebuild decorations on every transaction so we stay in sync
          // with thread data changes (not just document changes).
          const threads = getThreads();
          const doc = transaction.state.doc;

          const marks: { from: number; to: number; value: any }[] = [];

          for (const thread of threads) {
            if (thread.status === 'resolved') continue;

            const { anchor } = thread;
            if (!anchor.quote) continue;

            // Try to locate the anchor quote near the stored offset
            const searchFrom = Math.max(0, anchor.startOffset - 200);
            const searchTo = Math.min(doc.length, anchor.endOffset + 200);
            const slice = doc.sliceString(searchFrom, searchTo);
            const idx = slice.indexOf(anchor.quote);

            if (idx === -1) continue;

            const from = searchFrom + idx;
            const to = from + anchor.quote.length;

            if (from >= 0 && to <= doc.length && from < to) {
              marks.push({
                from,
                to,
                value: Decoration.mark({
                  class: `thread-anchor-highlight status-${thread.status}`,
                  attributes: { 'data-thread-id': thread.id },
                }),
              });
            }
          }

          if (marks.length === 0) {
            return Decoration.none;
          }

          // Sort marks by position (required by CodeMirror RangeSet)
          marks.sort((a, b) => a.from - b.from || a.to - b.to);

          return Decoration.set(
            marks.map(m => m.value.range(m.from, m.to))
          );
        } catch {
          return Decoration.none;
        }
      },

      provide: (field: any) => EditorView.decorations.from(field),
    });

    return [threadDecorationsField];
  } catch {
    // CodeMirror not available — return empty extension (safe for tests)
    return [];
  }
}
