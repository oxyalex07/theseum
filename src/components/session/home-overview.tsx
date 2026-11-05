import { useState } from 'react';
import { isActiveRun } from '../../../shared/bridge';
import { gitWorkTitle } from '../../../shared/git';
import type { RunInspectorTab, GitView } from '@/lib/session-overview';
import { useApp } from '@/state/app-context';
import { selectSession } from '@/state/model';
import { useSamplePreview } from '@/state/sample-preview';
import { statusLabels } from '@/types';
import { Icon } from '../common';
import { Button } from '../ui/button';
import { RunOverview, DemoOverview } from './overview';

export function HomeOverview() {
  const { m, update, openTask } = useApp();
  const { samples } = useSamplePreview();
  const [chosen, setChosen] = useState('');
  const runs = Object.values(m.runs).sort((a, b) =>
    Number(isActiveRun(b.status)) - Number(isActiveRun(a.status)) || b.startedAt.localeCompare(a.startedAt));
  const run = runs.find(item => item.id === chosen) ?? runs.find(item => item.id === m.selected) ?? runs[0];
  const demos = samples && !run ? m.sessions.filter(session => !session.runId) : [];
  const demo = demos.find(session => session.id === chosen) ?? demos.find(session => session.id === m.selected) ?? demos[0];
  const open = (tab: RunInspectorTab, gitView?: GitView) => {
    if (!run) return;
    update(d => {
      d.runInspectorViews[run.id] = { tab, gitView };
      selectSession(d, run.id);
      d.layout = 'focus';
      d.showInspector = true;
    });
  };
  const openDemo = (tab: string, subtab?: string) => {
    if (!demo) return;
    update(d => {
      selectSession(d, demo.id);
      d.layout = 'focus';
      d.showInspector = true;
      d.inspector = tab;
      if (subtab) d.subtab = subtab;
    });
  };

  if (!run && !demo) return <div className="session-overview home-overview">
    <section className="home-overview-empty">
      <Icon name="list" size={24}/><h2>Your runs at a glance</h2>
      <p>Start a task to see its status, checkout changes, checks, and next action here.</p>
      <Button size="sm" variant="primary" onClick={() => openTask()}>Write a task<Icon name="right" size={12}/></Button>
    </section>
  </div>;

  return <div className="home-overview">
    <div className="home-overview-picker">
      <label htmlFor="overview-session">{run ? 'Active & recent sessions' : 'Sample sessions'}</label>
      <select id="overview-session" value={run?.id ?? demo?.id} onChange={event => setChosen(event.target.value)}>
        {run ? runs.map(item => <option key={item.id} value={item.id}>{item.projectName} · {gitWorkTitle(item).slice(0, 60)} · {statusLabels[item.status]}</option>) : demos.map(session => <option key={session.id} value={session.id}>{session.t} · {statusLabels[session.st]}</option>)}
      </select>
      <button className="overview-link" onClick={() => run ? open('overview') : openDemo('overview')}>Open session<Icon name="right" size={12}/></button>
    </div>
    {run ? <RunOverview key={run.id} run={run} open={open}/> : demo ? <DemoOverview session={demo} open={openDemo}/> : null}
  </div>;
}
