import { ResearchDraftRecovery } from '@/components/session/research-drafts';
import { ProfilePage } from '@/components/pages/profile';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/app-context';
import { eventBinding, normalizeBinding } from '@/state/keyboard';
import { selectSession } from '@/state/model';
import { TitleBar, Rail, Sidebar, SessionTabs, StatusBar } from '@/components/layout/shell';
import { HistoryPage } from '@/components/pages/history';
import { HomePage } from '@/components/pages/home';
import { CrewPage, MemoryPage, RoutinesPage } from '@/components/pages/crew-memory-routines';
import { SettingsPage } from '@/components/pages/settings';
import { SessionWorkspace } from '@/components/session/conversation';
import { Inspector } from '@/components/session/inspector';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/common';

const TerminalPage=lazy(()=>import('@/components/pages/terminal').then(module=>({default:module.TerminalPage})));
const LibraryPage=lazy(()=>import('@/components/pages/library').then(module=>({default:module.LibraryPage})));
const BrowserPage=lazy(()=>import('@/components/pages/browser').then(module=>({default:module.BrowserPage})));

export default function App(){
  const {m,update,select,openTask,resolve,toast,executionMode,setExecutionMode}=useApp();const [commandOpen,setCommandOpen]=useState(false);const [command,setCommand]=useState('');
  const [compactPanel,setCompactPanel]=useState<'workspace'|'sidebar'|'inspector'>('workspace');
  const workspaceButton=useRef<HTMLButtonElement>(null);
  const inspectorButton=useRef<HTMLButtonElement>(null);
  const inspectorPanel=useRef<HTMLDivElement>(null);
  const inspectorWasShown=useRef(m.showInspector);
  useEffect(()=>{
    const restoringInspector=!inspectorWasShown.current&&m.showInspector;
    inspectorWasShown.current=m.showInspector;
    const compact=window.matchMedia('(max-width: 1250px)').matches;
    if(restoringInspector){
      setCompactPanel('inspector');
      if(compact)inspectorButton.current?.focus();
      else inspectorPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();
      return;
    }
    const button=workspaceButton.current;
    if(button?.closest('.compact-sidebar,.compact-inspector')&&compact)button.focus();
    setCompactPanel('workspace');
  },[m.page,m.selected,m.section,m.layout,m.showInspector]);
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      if(e.defaultPrevented)return;
      const combo=eventBinding(e);if(!combo)return;
      const dialogs=[...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')];
      const typing=e.target instanceof HTMLElement&&!!e.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');const keys=m.settings.keys;
      const matches=(id:string)=>combo===normalizeBinding(keys[id]);
      // A modified palette shortcut remains useful from a composer. Plain keys never interrupt typing.
      if(matches('cmdk')&&(!typing||e.metaKey||e.ctrlKey||e.altKey)&&dialogs.every(dialog=>commandOpen&&dialog.hasAttribute('data-command-palette'))){e.preventDefault();setCommandOpen(v=>!v);return;}
      if(typing||dialogs.length)return;
      if(matches('home')){e.preventDefault();update(d=>{d.page='home';});}
      else if(matches('new')){e.preventDefault();openTask();}
      else if(matches('focus')||matches('split')||matches('grid')){e.preventDefault();update(d=>{selectSession(d,d.selected);d.layout=matches('focus')?'focus':matches('split')?'split':'grid';});}
      else if(matches('search')&&m.page==='settings'){e.preventDefault();document.querySelector<HTMLInputElement>('#settings-search')?.focus();}
      else if((matches('next')||matches('previous'))&&m.page==='session'&&m.sessions.length){
        e.preventDefault();const i=m.sessions.findIndex(s=>s.id===m.selected);select(m.sessions[(i+(matches('next')?1:-1)+m.sessions.length)%m.sessions.length].id);
      }else if((matches('approve')||matches('ad')||matches('deny'))&&m.page==='session'){
        e.preventDefault();resolve(m.selected,matches('deny')?'deny':'approve');
      }
    };
    document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);
  },[m,update,select,openTask,resolve,commandOpen]);
  const noSidebar=['crew','memory','routines','profile','library','browser','terminal'].includes(m.page);
  const noInspector=['crew','memory','routines','settings','history','profile','library','browser','terminal'].includes(m.page)||(m.page==='session'&&(m.layout!=='focus'||!m.showInspector));
  const body=m.page==='terminal'?<TerminalPage/>:m.page==='library'?<LibraryPage/>:m.page==='browser'?<BrowserPage/>:m.page==='profile'?<ProfilePage/>:m.page==='history'?<HistoryPage/>:m.page==='home'?<HomePage/>:m.page==='crew'?<CrewPage/>:m.page==='memory'?<MemoryPage/>:m.page==='routines'?<RoutinesPage/>:m.page==='settings'?<SettingsPage/>:<SessionWorkspace/>;
  return <div className={`app ${noInspector?'no-insp':''} ${noSidebar?'no-sidebar':''} compact-${compactPanel} ${m.settings.values.density==='compact'?'density-compact':''}`}><TitleBar onCommand={()=>setCommandOpen(true)}/><div className="body"><Rail onCommand={()=>setCommandOpen(true)}/><nav className="compact-panels" aria-label="Workspace panels"><button ref={workspaceButton} className="btn" aria-pressed={compactPanel==='workspace'} aria-controls="workspace-main" onClick={()=>setCompactPanel('workspace')}>Workspace</button>{!noSidebar&&<button className="btn" aria-expanded={compactPanel==='sidebar'} aria-controls="workspace-sidebar" onClick={()=>setCompactPanel(compactPanel==='sidebar'?'workspace':'sidebar')}>{m.page==='settings'?'Settings sections':'Sessions'}</button>}{!noInspector&&<button ref={inspectorButton} className="btn" aria-expanded={compactPanel==='inspector'} aria-controls="workspace-inspector" onClick={()=>setCompactPanel(compactPanel==='inspector'?'workspace':'inspector')}>Inspector</button>}</nav>{!noSidebar&&<div className="sidebar-panel" id="workspace-sidebar"><Sidebar/></div>}<main className="main" id="workspace-main"><SessionTabs/><Suspense fallback={<div className="empty-note">Loading view…</div>}>{body}</Suspense></main>{!noInspector&&<div ref={inspectorPanel} className="inspector-panel" id="workspace-inspector"><Inspector/></div>}</div><StatusBar><ResearchDraftRecovery/></StatusBar>{m.page==='session'&&m.layout==='focus'&&!m.showInspector&&<button className="restore-panel" onClick={()=>update(d=>{d.showInspector=true;})}><Icon name="cols" size={12}/>Show inspector</button>}
    <div className={`toast ${toast?'on':''}`} role="status" aria-live="polite">{toast&&<><Icon name="check"/>{toast}</>}</div>
    <Dialog open={commandOpen} onOpenChange={setCommandOpen}><DialogContent data-command-palette><DialogTitle>Ask Theseus</DialogTitle><DialogDescription>Search sessions or prepare a task. Review routing and project context before starting.</DialogDescription><div className="seg" role="radiogroup" aria-label="Task execution mode"><button role="radio" aria-checked={executionMode==='live'} className={executionMode==='live'?'on':''} onClick={()=>setExecutionMode('live')}>Codex · Live</button><button role="radio" aria-checked={executionMode==='demo'} className={executionMode==='demo'?'on':''} onClick={()=>setExecutionMode('demo')}>Demo · simulated</button></div><input className="command-input" aria-label="Command palette search" placeholder="Find a session or describe a task…" value={command} onChange={e=>setCommand(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&command.trim()){openTask(command);setCommand('');setCommandOpen(false);}}}/><div className="command-results">{m.sessions.filter(s=>`${s.t} ${m.agents[s.ag].n}`.toLowerCase().includes(command.toLowerCase())).slice(0,8).map(s=><button key={s.id} onClick={()=>{select(s.id);setCommandOpen(false);}}><Icon name="msg" size={14}/><span className="trunc">{s.t}</span><small>{m.agents[s.ag].n}</small></button>)}</div><div className="btns"><button className="btn p" disabled={!command.trim()} onClick={()=>{openTask(command);setCommand('');setCommandOpen(false);}}>Review {executionMode==='live'?'live':'demo'} task</button><button className="btn" onClick={()=>{setCommandOpen(false);update(d=>{d.page='settings';});}}>Settings</button></div></DialogContent></Dialog>
  </div>;
}
