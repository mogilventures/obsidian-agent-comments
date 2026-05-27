/**
 * Empty mock stubs for @codemirror/* packages.
 * These are externalized at build time (Obsidian provides them at runtime)
 * and mocked here for the Jest test environment.
 */

export const StateField = {};
export const StateEffect = {};
export const RangeSetBuilder = class {};
export const Transaction = {};
export const Extension = {};

export const Decoration = {
  mark: () => ({}),
  none: {},
  set: () => ({}),
};

export const DecorationSet = {};

export const EditorView = {};
export const ViewPlugin = {};
export const WidgetType = class {};

export const MatchDecorator = class {};

export default {};
