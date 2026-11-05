import { describe, expect, it } from 'vitest';
import { checkoutChanges, overviewChecks } from '../src/lib/session-overview';
import type { GitSnapshot } from '../shared/git';

describe('overview checkout changes', () => {
  it('preserves unstaged status, rename paths, and quoted filenames', () => {
    expect(checkoutChanges(' M src/app.tsx\nA  new.ts\nR  old.ts -> new.ts\n?? "notes with spaces.md"\n')).toEqual([
      { status: 'M', path: 'src/app.tsx' },
      { status: 'A', path: 'new.ts' },
      { status: 'R', path: 'old.ts -> new.ts' },
      { status: '??', path: '"notes with spaces.md"' },
    ]);
    expect(checkoutChanges('')).toEqual([]);
  });
});

describe('overview check evidence', () => {
  it('keeps unavailable and absent checks distinct from passing checks', () => {
    for (const snapshot of [null, { pr: null }, { pr: { statusCheckRollup: [] } }]) {
      const summary = overviewChecks(snapshot as GitSnapshot | null);
      expect(summary.checks).toHaveLength(0);
      expect(summary.passed).toHaveLength(0);
    }
  });

  it('separates failures, pending results, skipped checks, and successes', () => {
    const snapshot = { pr: { statusCheckRollup: [
      { name: 'build', conclusion: 'SUCCESS' },
      { name: 'tests', conclusion: 'FAILURE' },
      { name: 'lint', status: 'IN_PROGRESS' },
      { name: 'deploy', conclusion: 'SKIPPED' },
      { context: 'legacy', state: 'ERROR' },
      { name: 'new status', conclusion: 'UNKNOWN' },
    ] } } as GitSnapshot;
    const summary = overviewChecks(snapshot);
    expect(summary.failed.map(check => check.name)).toEqual(['tests', 'legacy']);
    expect(summary.passed.map(check => check.name)).toEqual(['build']);
    expect(summary.skipped.map(check => check.name)).toEqual(['deploy']);
    expect(summary.pending).toBe(2);
  });
});
