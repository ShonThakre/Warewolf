/**
 * One log line of ids (WW-1304). Keys that are not in this list are dropped,
 * so a role name or a display name cannot be written by passing it in.
 */
const KEYS = ['request', 'method', 'path', 'status', 'ms', 'game', 'round', 'player', 'action', 'from', 'to', 'by', 'seq', 'deaths', 'conversions', 'hash'] as const;

export function logLine(scope: string, fields: Readonly<Record<string, string | number>>): string {
  const parts = KEYS.filter((key) => fields[key] !== undefined).map((key) => `${key}=${fields[key]}`);
  return `${scope} ${parts.join(' ')}`.trim();
}
