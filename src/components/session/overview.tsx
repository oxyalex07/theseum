import { useEffect, useState } from 'react';
import type { AgentRun } from '../../../shared/bridge';
import { isActiveRun } from '../../../shared/bridge';
import { reviewResult, type GitSnapshot } from '../../../shared/git';
import { checkoutChanges, latestRunActivity, overviewChecks, type RunInspectorTab, type GitView } from '@/lib/session-overview';
import { mockFiles, mockProjects } from '@/data/mock-data';
import type { Session } from '@/types';
import { Icon, StatusPill } from '../common';
import { Button } from '../ui/button';
import './overview.css';

type OpenRunView = (tab: RunInspectorTab, gitView?: GitView) => void;

const descriptions: Record<AgentRun['status'], string> = {
  queued: 'Waiting for a live slot, project checkout, or crew prerequisite.',
  starting: 'Preparing the project and connecting to Codex.',
  running: 'Codex is working. New output appears in the conversation.',
  cancelling: 'Waiting for Codex to stop. Existing edits will be kept.',
  completed: 'Codex finished successfully. Review the changes and checks below.',
  failed: 'The run failed. Inspect its error before continuing.',
  cancelled: 'The run stopped. Existing edits are still in the checkout.',
  interrupted: 'Tracking ended before completion. Review the output and checkout.',
};

export function RunOverview({ run, open }: { run: AgentRun; open: OpenRunView }) {
  const [snapshot, setSnapshot] = useState<GitSnapshot | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [checkedAt, setCheckedAt] = useState('');
  useEffect(() => {
    let current = true;
    const bridge = window.theseus;
    setLoading(true);
    setSnapshot(null);
    setCheckedAt('');
    setError('');
    if (!bridge) { setLoading(false); return; }
    void bridge.getGitSnapshot({ runId: run.id }).then(value => {
      if (current) { setSnapshot(value); setCheckedAt(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })); }
    }).catch(reason => {
      if (current) setError(reason instanceof Error ? reason.message : 'Could not load checkout changes.');
    }).finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [run.id, run.status, refresh]);
  useEffect(() => {
    const refreshOnFocus = () => setRefresh(value => value + 1);
    window.addEventListener('focus', refreshOnFocus);
    return () => window.removeEventListener('focus', refreshOnFocus);
  }, []);

  const files = checkoutChanges(snapshot?.status ?? '');
  const { checks, failed, passed, skipped, pending } = overviewChecks(snapshot);
  const review = reviewResult(run);
  const activity = review ? { kind: 'review', text: review.summary, truncated: false } : latestRunActivity(run);
  const action = run.error || run.persistenceError || ['failed', 'interrupted'].includes(run.status)
    ? { label: 'Inspect run details', text: 'Review the run error and execution state.', tab: 'details' as const }
    : failed.length
      ? { label: 'Inspect failing checks', text: `${failed.length} GitHub check${failed.length === 1 ? ' needs' : 's need'} attention.`, tab: 'changes' as const, gitView: 'checks' as const }
      : review?.findings.length
        ? { label: 'Review findings', text: `${review.findings.length} finding${review.findings.length === 1 ? '' : 's'} reported by this run.`, tab: 'changes' as const, gitView: 'review' as const }
        : isActiveRun(run.status)
          ? { label: 'View run details', text: 'Follow the conversation for new output while this run is active.', tab: 'details' as const }
          : files.length || snapshot?.pr
            ? { label: 'Review Git changes', text: 'Inspect the diff before deciding what to do next.', tab: 'changes' as const, gitView: 'files' as const }
            : run.crew && ['scout', 'quill'].includes(run.crew.role)
              ? { label: 'Open research & artifacts', text: 'Inspect saved sources or prepare an artifact from the run output.', tab: 'research' as const }
              : { label: 'View run details', text: 'Review the execution details alongside the conversation output.', tab: 'details' as const };

  return <div className="session-overview" aria-label="Session overview">
    <section className="overview-status">
      <div className="overview-heading"><h2>Run status</h2><StatusPill status={run.status}/></div>
      <p>{descriptions[run.status]}</p>
      <div className="overview-project"><Icon name="folder" size={13}/><span>{run.projectName}{snapshot && <> · <span className="mono">{snapshot.branch}</span></>}</span></div>
      {(run.error || run.persistenceError) && <p className="overview-error" role="alert">{run.error || run.persistenceError}</p>}
      {activity && <div className="overview-activity"><h3>Latest activity <span>{activity.kind}</span></h3><p>{activity.text}{activity.truncated ? '…' : ''}</p></div>}
    </section>
    <section className="overview-next">
      <h3>Next action</h3><p>{action.text}</p>
      <Button size="sm" variant="primary" onClick={() => open(action.tab, action.gitView)}>{action.label}<Icon name="right" size={12}/></Button>
    </section>
    <section aria-busy={loading}>
      <div className="overview-heading"><h3>Checkout changes{snapshot && <span>{files.length}</span>}</h3><button className="overview-link" disabled={loading || !window.theseus} onClick={() => setRefresh(value => value + 1)}>{loading ? 'Refreshing…' : 'Refresh'}</button></div>
      {loading ? <p role="status">Loading the checkout and GitHub checks…</p> : error ? <p className="overview-error" role="alert">{error}</p> : !snapshot ? <p>Open the desktop app to inspect checkout changes.</p> : <>
        <p className="overview-note">Current checkout, including edits made before this run.</p>
        {files.length ? <ul className="overview-files">{files.slice(0, 5).map((file, index) => <li key={`${file.path}-${index}`}><button onClick={() => open('changes', 'files')}><Icon name="file" size={13}/><span>{file.path}</span><code>{file.status}</code></button></li>)}</ul> : <p>No uncommitted changes.</p>}
        <button className="overview-link" onClick={() => open('changes', 'files')}>{files.length > 5 ? `View all ${files.length} changed paths` : 'Open Git changes'}<Icon name="right" size={12}/></button>
      </>}
    </section>
    <section>
      <div className="overview-heading"><h3>GitHub checks</h3>{checks.length > 0 && <button className="overview-link" onClick={() => open('changes', 'checks')}>View checks<Icon name="right" size={12}/></button>}</div>
      {loading ? <p>Loading check results…</p> : checks.length ? <>
        <div className="overview-check-summary">{failed.length > 0 && <span className="overview-error">{failed.length} failed</span>}{passed.length > 0 && <span className="overview-success">{passed.length} passed</span>}{pending > 0 && <span>{pending} pending</span>}{skipped.length > 0 && <span>{skipped.length} skipped / neutral</span>}</div>
        <ul className="overview-checks">{[...failed, ...checks.filter(check => !failed.includes(check))].slice(0, 4).map((check, index) => <li key={`${check.name}-${index}`}><span>{check.name}</span><small>{check.conclusion || check.status}</small></li>)}</ul>
      </> : <p>{snapshot?.pr ? 'No checks reported for this pull request.' : 'No GitHub check results available.'}</p>}
      {!loading && snapshot?.githubError && <details className="overview-check-error"><summary>Why checks are unavailable</summary><p>{snapshot.githubError}</p></details>}
      <p className="overview-note">Local command results remain in the conversation.{checkedAt && ` Snapshot refreshed ${checkedAt}.`}</p>
    </section>
  </div>;
}

export function DemoOverview({ session, open }: { session: Session; open: (tab: string, subtab?: string) => void }) {
  const code = mockProjects[session.pj]?.sp !== 'research';
  const files = mockFiles[session.id] ?? [];
  return <div className="session-overview" aria-label="Session overview">
    <section>
      <div className="overview-heading"><h2>Session status</h2><StatusPill status={session.st}/></div>
      <p className="overview-note">Demo · simulated activity and results.</p>
      <p>{session.prev[1]}</p>
      <div className="overview-project"><Icon name="folder" size={13}/><span>{mockProjects[session.pj]?.n}{session.br && <> · <span className="mono">{session.br}</span></>}</span></div>
    </section>
    <section className="overview-next"><h3>Next action</h3><p>{code ? session.ci === 'fail' ? 'Inspect the sample check results and changed files.' : 'Review the sample changes alongside the conversation.' : 'Review the sample sources and draft.'}</p><Button size="sm" variant="primary" onClick={() => open(code ? 'changes' : 'sources', code && session.ci === 'fail' ? 'checks' : 'changes')}>{code ? session.ci === 'fail' ? 'Inspect sample checks' : 'Review sample changes' : 'Review sample sources'}<Icon name="right" size={12}/></Button></section>
    {code ? <>
      <section><div className="overview-heading"><h3>Sample changed files<span>{files.length}</span></h3></div>{files.length ? <ul className="overview-files">{files.slice(0, 5).map(([path, added, removed]) => <li key={path}><button onClick={() => open('changes', 'changes')}><Icon name="file" size={13}/><span>{path}</span><small><span className="overview-success">+{added}</span> <span className="overview-error">−{removed}</span></small></button></li>)}</ul> : <p>No sample file changes.</p>}</section>
      <section><h3>Sample checks</h3><p>{session.ci === 'fail' ? 'Checks failing in this demo.' : session.ci === 'ok' ? 'Checks passing in this demo.' : 'No check results reported.'}</p><button className="overview-link" onClick={() => open('changes', 'checks')}>Open sample checks<Icon name="right" size={12}/></button></section>
    </> : <section><h3>Research</h3><p>{session.srcN ?? 0} sample sources{session.words ? ` · ${session.words} draft words` : ''}</p><button className="overview-link" onClick={() => open('draft')}>Open sample draft<Icon name="right" size={12}/></button></section>}
  </div>;
}
