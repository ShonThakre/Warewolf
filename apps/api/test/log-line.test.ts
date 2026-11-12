import { describe, expect, it } from 'vitest';
import { logLine } from '../src/http/log-line.js';

describe('log lines', () => {
  it('keeps ids and drops a role name', () => {
    const line = logLine('phase', { game: 'game-1', round: 2, from: 'NIGHT_SUBMIT', to: 'DAY_ANNOUNCE', by: 'HOST', role: 'pack_wolf', displayName: 'Asha' });
    expect(line).toBe('phase game=game-1 round=2 from=NIGHT_SUBMIT to=DAY_ANNOUNCE by=HOST');
    expect(line).not.toContain('pack_wolf');
    expect(line).not.toContain('Asha');
    expect(line).not.toContain('role');
  });
});
