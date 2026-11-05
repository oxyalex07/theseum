import type { AgentRun } from '../../shared/bridge';
import { checksFor, type GitSnapshot } from '../../shared/git';

export type RunInspectorTab = 'overview' | 'changes' | 'research' | 'terminal' | 'preview' | 'details';
export type GitView = 'files' | 'commits' | 'checks' | 'review';
export interface RunInspectorView { tab: RunInspectorTab; gitView?: GitView; artifactKind?: import('../../shared/research').ResearchKind }

export function checkoutChanges(status: string) {
  // Preserve porcelain's two status columns, including an unstaged leading space.
  return status.split('\n').filter(line => line.length > 3).map(line => ({
    status: line.slice(0, 2).trim(), path: line.slice(3),
  }));
}

export function overviewChecks(snapshot: GitSnapshot | null) {
  const checks = snapshot?.pr ? checksFor(snapshot.pr) : [];
  const failed = checks.filter(check => ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'STALE'].includes(check.conclusion.toUpperCase()));
  const passed = checks.filter(check => check.conclusion.toUpperCase() === 'SUCCESS');
  const skipped = checks.filter(check => ['NEUTRAL', 'SKIPPED'].includes(check.conclusion.toUpperCase()));
  const pending = checks.length - failed.length - passed.length - skipped.length;
  return { checks, failed, passed, skipped, pending };
}

export function latestRunActivity(run: AgentRun) {
  const event = run.output.filter(entry => ['command', 'output', 'file', 'message', 'error'].includes(entry.kind)).at(-1);
  if (!event) return null;
  return { kind: event.kind, text: event.text.slice(0, 240), truncated: event.text.length > 240 };
}
