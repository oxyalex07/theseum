import { commandError } from './session-actions';
import { keyboardPreferences } from './keyboard';
import type { RunInspectorView } from '../lib/session-overview';
import type { RendererPreferences } from './preferences';
import { gitWorkTitle } from '../../shared/git';
import type { AgentRun } from '../../shared/bridge';
import type { Agent, AgentId, Layout, MemoryGroup, Message, Page, Routine, SectionId, Session, Settings, Space } from '../types';
import { mockAgents, mockMemory, mockRoutines, mockSessions, mockSettings, mockThreads } from '../data/mock-data';
export interface Model {
  lastSession?:string; pendingStartupSession?:string;
  demoPending: Record<string, Message[]>;
  runs: Record<string, AgentRun>;
  runInspectorViews: Record<string, RunInspectorView>;
  agents: Record<AgentId, Agent>; sessions: Session[]; threads: Record<string, Message[]>;
  memory: Record<string, MemoryGroup>; routines: Routine[]; settings: Settings;
  page: Page; selected: string; open: string[]; layout: Layout; space: Space; query: string;
  inspector: string; subtab: string; showInspector: boolean; section: SectionId; settingsQuery: string;
  fixed: number[]; expanded: string[]; homeAgent: AgentId; drafts: Record<string, string>;
}
export function createModel(search = '', preferences?:RendererPreferences): Model {
  const p = new URLSearchParams(search);
  const settings=structuredClone(mockSettings);Object.assign(settings.values,preferences?.general);Object.assign(settings.keys,keyboardPreferences(preferences?.keyboard));
  const explicit=p.has('page')||p.has('s');
  const requested=p.get('s')??(!explicit&&settings.values.start==='last'?preferences?.lastSession:undefined);
  const known=mockSessions.some(s=>s.id===requested);
  const id=known?requested!:'c1';
  const pages: Page[] = ['home','session','crew','memory','routines','settings','history','profile','library','browser','terminal'];
  const layouts: Layout[] = ['focus','split','grid'];
  const spaces: Space[] = ['all','code','research'];
  const secs: SectionId[] = ['general','models','safety','spaces','notify','memory','ints','keys','about'];
  return {
    demoPending: {}, runs: {}, runInspectorViews: {}, agents: structuredClone(mockAgents), sessions: structuredClone(mockSessions), threads: structuredClone(mockThreads),
    memory: structuredClone(mockMemory), routines: structuredClone(mockRoutines), settings, lastSession:preferences?.lastSession, pendingStartupSession:requested&&!known&&(!p.has('page')||p.get('page')==='session')?requested:undefined,
    page: pages.find(x=>x===p.get('page')) ?? (p.has('s')||(!explicit&&known) ? 'session' : 'home'), selected: id,
    open: [...new Set([id,'r1','r2'])], layout: layouts.find(x=>x===p.get('view')) ?? settings.values.dview as Layout,
    space: spaces.find(x=>x===p.get('space')) ?? settings.values.dspace as Space, query: '', inspector: p.get('tab') ?? '', subtab: 'changes',
    showInspector: true, section: secs.find(x=>x===p.get('section')) ?? 'general', settingsQuery: '',
    fixed: [], expanded: ['src/components/StreakChart.tsx'], homeAgent: (Object.keys(mockAgents).includes(String(settings.values.dag))?settings.values.dag:'orbit') as AgentId, drafts: {},
  };
}
export function selectSession(m: Model, id: string) {
  if (!m.sessions.some(s=>s.id===id)) return;
  m.page='session'; m.selected=id;m.lastSession=id;
  if (!m.open.includes(id)) m.open=[...m.open.slice(-3),id];
}
// These are demo transitions only. No backend execution is triggered by an approval.
export function resolveSession(m: Model, id: string, action: 'approve' | 'always' | 'deny' | 'retry') {
  const session=m.sessions.find(s=>s.id===id); if (!session || session.runId || session.st==='paused') return;
  const thread=m.threads[id] ??= [];
  const kind=action==='retry'?'error':'approval';
  const ix=thread.findIndex(x=>x.card===kind); if (ix<0) return;
  const command=thread[ix].cmd;
  if(kind==='approval'&&(!command||commandError(command)))return;
  thread.splice(ix,1);
  session.st=action==='deny'?'thinking':'running';
  session.prev=[action==='deny'?'THINK':'BASH',action==='deny'?'looking for an alternative':action==='retry'?'pnpm build · demo retry':command!];
  thread.push({r:action==='approve'||action==='always'?'ag':'you',plain:true,t:action==='deny'?'No. Find another way.':action==='retry'?'Demo retry requested. No build, checkout, or reset was performed.':'Approved in demo mode. No command was executed.'});
  if (action==='always'&&command) {
    m.memory.code.xs.push({t:`Demo approval: ${command}`,nw:1});
    // This is a demo preference, never an execution policy.
    if (!m.settings.allow.includes(command)) m.settings.allow.push(command);
  }
}

// Main owns run truth. Revisions prevent an older IPC response overwriting a newer event.
export function applyAgentRun(m: Model, run: AgentRun) {
  if(m.runs[run.id] && m.runs[run.id].revision>run.revision)return;
  m.runs[run.id]=run;
  const session=m.sessions.find(s=>s.runId===run.id);
  const live:Session={id:run.id,runId:run.id,projectName:run.projectName,ag:run.crew?.role??'forge',pj:'live',t:(run.crew?`${run.crew.role} · ${run.task}`:gitWorkTitle(run)).slice(0,48),st:run.status,time:run.endedAt?'finished':'now',prev:['CODEX',run.error??run.status]};
  if(session)Object.assign(session,live);else m.sessions.unshift(live);
}

export function removeAgentRuns(m:Model,ids:string[]){
  const removed=new Set(ids);
  for(const id of ids){delete m.runs[id];delete m.runInspectorViews[id];delete m.threads[id];delete m.drafts[id];}
  m.sessions=m.sessions.filter(s=>!removed.has(s.runId??s.id));m.open=m.open.filter(id=>!removed.has(id));
  if(removed.has(m.selected)){m.selected=m.open[0]??m.sessions[0]?.id??'';if(!m.selected||m.page==='session')m.page='history';}
}

// Resolve only after main has recovered history; opening a run never resumes execution.
export function restoreStartupSession(m:Model){
  const id=m.pendingStartupSession;delete m.pendingStartupSession;
  if(id&&m.sessions.some(s=>s.id===id))selectSession(m,id);
  else if(id)m.page='home';
}
export function applyNewSessionDefaults(m:Model){m.layout=m.settings.values.dview as Layout;}
