import { routeThreadToProvider } from '../src/provider-router';

const ALL_ENABLED = ['hermes', 'claude-code', 'codex'];

describe('routeThreadToProvider', () => {
  it('returns hermes for ["Steve"] when hermes is enabled', () => {
    expect(routeThreadToProvider(['Steve'], ALL_ENABLED)).toBe('hermes');
  });

  it('returns hermes for ["Hermes"] when hermes is enabled', () => {
    expect(routeThreadToProvider(['Hermes'], ALL_ENABLED)).toBe('hermes');
  });

  it('returns claude-code for ["Claude"] when enabled', () => {
    expect(routeThreadToProvider(['Claude'], ALL_ENABLED)).toBe('claude-code');
  });

  it('returns claude-code for ["ClaudeCode"] when enabled', () => {
    expect(routeThreadToProvider(['ClaudeCode'], ALL_ENABLED)).toBe('claude-code');
  });

  it('returns codex for ["Codex"] when enabled', () => {
    expect(routeThreadToProvider(['Codex'], ALL_ENABLED)).toBe('codex');
  });

  it('returns null when the matching provider is disabled', () => {
    // hermes not in enabled list
    expect(routeThreadToProvider(['Steve'], ['claude-code', 'codex'])).toBeNull();
    expect(routeThreadToProvider(['Hermes'], ['codex'])).toBeNull();
  });

  it('returns first match when multiple mentions are present', () => {
    // Steve → hermes, Claude → claude-code; hermes comes first
    const result = routeThreadToProvider(['Steve', 'Claude'], ALL_ENABLED);
    expect(result).toBe('hermes');
  });

  it('returns second match if first provider is disabled', () => {
    // hermes disabled; claude-code enabled → Claude routes to claude-code
    const result = routeThreadToProvider(['Steve', 'Claude'], ['claude-code', 'codex']);
    expect(result).toBe('claude-code');
  });

  it('returns null for unknown mentions', () => {
    expect(routeThreadToProvider(['GPT', 'Unknown'], ALL_ENABLED)).toBeNull();
  });

  it('returns null for empty mentions array', () => {
    expect(routeThreadToProvider([], ALL_ENABLED)).toBeNull();
  });

  it('returns null when enabled providers is empty', () => {
    expect(routeThreadToProvider(['Steve', 'Claude'], [])).toBeNull();
  });
});
