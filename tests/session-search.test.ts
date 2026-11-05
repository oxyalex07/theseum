import { describe, expect, it } from 'vitest';
import { searchSessions } from '../src/lib/session-search';
import { applyAgentRun, createModel, selectSession } from '../src/state/model';
import type { AgentRun } from '../shared/bridge';
const run = (patch: Partial<AgentRun> = {}): AgentRun => ({
  id:'saved', revision:1, workspaceId:'workspace', projectName:'Real project', projectPath:'/approved/project', task:'Saved task with a long title and unique untruncated tail', status:'completed', startedAt:'2026-10-26T00:00:00Z', output:[], truncated:false, ...patch,
});
const ids = (m: ReturnType<typeof createModel>, query: string) => searchSessions(m, query).map(result => result.session.id);
describe('recorded session search', () => {
  it('matches normalized title, project and demo agent queries and navigates every result', () => {
    const m = createModel();
    for (const [query, id] of [['  STREAK CHART  ','c1'],['habit-tracker-app','c1'],['Scout','r1'],['LangGraph docs','r1'],['src/components/StreakChart.tsx','c1'],['drafts/ai-notes-12.md','r2'],['package.json','c1']]) {
      expect(ids(m,query)).toContain(id);
      selectSession(m, searchSessions(m,query).find(result=>result.session.id===id)!.session.id);
      expect(m.selected).toBe(id); expect(m.page).toBe('session');
    }
    expect(ids(m,'  ')).toHaveLength(m.sessions.length);
    expect(ids(m,'unrecorded-secret.txt')).toEqual([]);
  });
  it('does not attach generic inspector fallback sources or files to other sessions', () => {
    const m=createModel();
    expect(ids(m,'StreakChart.tsx')).toEqual(['c1']);
    expect(ids(m,'LangGraph docs')).not.toContain('r2');
    expect(ids(m,'AGENTS.md')).toEqual([]);
    expect(ids(m,'notes/saved-links.md')).toEqual(['r2']);
  });
  it('searches saved run configuration, selected page context, file output and Git findings without demo leakage', () => {
    const m=createModel();
    const profile={name:'Snapshot specialist'} as NonNullable<AgentRun['agentConfiguration']>['profile'];
    applyAgentRun(m,run({agentConfiguration:{profile,approvalPolicy:'never',timeoutSeconds:1800},executionPath:'/worktrees/branch',pageSelection:[{id:'page',title:'Selected source guide',url:'https://example.org/guide',capturedAt:'now'}],output:[{sequence:1,kind:'file',text:'update src/real file.ts\nadd docs/recorded.md'}]}));
    for(const query of ['Real project','Snapshot specialist','untruncated tail','Selected source guide','example.org/guide','src/real file.ts','docs/recorded.md','worktrees/branch']) expect(ids(m,query)).toContain('saved');
    for(const query of ['Forge','StreakChart.tsx','LangGraph docs']) expect(ids(m,query)).not.toContain('saved');
    applyAgentRun(m,run({id:'review',gitWorkflow:{kind:'review',rootRunId:'saved',baseline:'head'},output:[{sequence:1,kind:'message',text:JSON.stringify({summary:'Review',findings:[{severity:'high',title:'Issue',path:'src/git-finding.ts',detail:'Problem'}]})}]}));
    expect(ids(m,'src/git-finding.ts')).toEqual(['review']);
    expect(ids(m,'Codex')).toContain('review');
    m.runs.saved.output=[];expect(ids(m,'src/real file.ts')).toEqual([]);
    delete m.runs.saved;expect(ids(m,'Snapshot specialist')).toEqual([]);
  });
  it('updates live records, preserves space filters, and removes deleted runs from results', () => {
    const m=createModel();applyAgentRun(m,run({status:'running'}));
    expect(ids(m,'live-only.ts')).toEqual([]);
    applyAgentRun(m,run({revision:2,status:'running',output:[{sequence:1,kind:'file',text:'update live-only.ts'}]}));
    expect(ids(m,'live-only.ts')).toEqual(['saved']);
    m.space='research';expect(ids(m,'live-only.ts')).toEqual([]);expect(ids(m,'Scout')).toContain('r1');
    m.space='code';expect(ids(m,'LangGraph docs')).toEqual([]);
    m.sessions=m.sessions.filter(s=>s.id!=='saved');expect(ids(m,'live-only.ts')).toEqual([]);
  });
});
