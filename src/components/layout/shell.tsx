import type { ReactNode } from 'react';
import { RoutineSidebar } from '../pages/routines';
import { useDesktopSettings } from '../pages/desktop-settings';
import { Notifications } from './notifications';
import { profileInitial, useLocalProfile } from '../profile/local-profile';
import { LayoutMenu } from './layout-menu';
import { useApp } from '@/state/app-context';
import { sessionPreview } from '@/state/session-actions';
import { mockProjects } from '@/data/mock-data';
import { NEEDY, statusLabels, type Layout, type Page, type Session, type Space } from '@/types';
import { Avatar, Icon, SpaceTag, StatusDot } from '../common';
import { brandAsset } from '@/lib/utils';
import { SettingsNavigation } from '../pages/settings';
import { searchSessions, sessionSearchScope, type SessionSearchMatch } from '@/lib/session-search';

export function TitleBar({onCommand}:{onCommand:()=>void}) {
  const {m,update,notify}=useApp();
  const {profile}=useLocalProfile();
  const desktop=useDesktopSettings();
  const occupied=Object.values(m.runs).filter(r=>['starting','running','cancelling'].includes(r.status)).length;
  const queued=Object.values(m.runs).filter(r=>r.status==='queued').length;
  const count=(sp:Space)=>m.sessions.filter(s=>(sp==='all'||mockProjects[s.pj]?.sp===sp)&&NEEDY.includes(s.st)).length;
  const windowAction=(action:'close'|'minimize'|'maximize')=>{if(window.theseus)void window.theseus.windowControl(action).catch(()=>notify('Window control failed'));else notify('Window controls are available in Electron');};
  return <header className="tbar"><div className="lights window-lights">{(['close','minimize','maximize'] as const).map(action=><button key={action} aria-label={`${action} window`} onClick={()=>windowAction(action)} />)}</div><span className="brand"><img src={brandAsset('lockup-horizontal-dark.svg')} alt="theseus.ai" width={105} height={24}/></span>
    <div className="spaces">{([['all','layers','All'],['code','code','Code'],['research','book','Research']] as const).map(([key,ic,label])=><button key={key} className={m.space===key?'on':''} onClick={()=>update(d=>{d.space=key;})}><Icon name={ic} size={12}/>{label}<span className="c">{count(key)}</span></button>)}</div>
    <button className="kbar" style={{width:380}} onClick={onCommand}><Icon name="search" size={13}/><span className="trunc">Ask Theseus, search, or run a command…</span><kbd>{m.settings.keys.cmdk}</kbd></button>
    <div className="tright"><span className="demo-badge" title="Live Codex runs are labeled; sample crew and usage remain simulated">LIVE + DEMO</span><span className="slots" title="Live Codex capacity" aria-live="polite">{window.theseus?`${occupied}/${desktop.state?.preferences.slots??1} live · ${queued} queued`:'Live capacity unavailable'}</span><Notifications/><button className="me profile-trigger" aria-label="Open your profile" aria-current={m.page==='profile'?'page':undefined} onClick={()=>update(d=>{d.page='profile';})}><span className="profile-name">{profile.name}</span><span className="pic">{profileInitial(profile.name)}</span></button></div>
  </header>;
}
export function Rail({onCommand}:{onCommand:()=>void}) {
  const {m,update,select,notify}=useApp();
  const nav=(page:Page)=>page==='session'?select(m.selected):update(d=>{d.page=page;});
  const items: [Page,string,string][]=[['home','home','Home'],['crew','users','Agents'],['memory','brain','Memory'],['routines','cal','Routines']];
  return <nav className="rail" aria-label="Primary"><div className="logo"><img src={brandAsset('mark-color-dark.svg')} alt="Theseus" width={34} height={34}/></div>{items.map(([page,ic,label])=><button key={page} aria-label={label} className={`ri ${m.page===page?'on':''}`} onClick={()=>nav(page)}><Icon name={ic} size={17}/>{page==='home'&&<span className="bdg">{m.sessions.filter(s=>NEEDY.includes(s.st)).length}</span>}<span className="tip">{label}</span></button>)}<span className="sep"/>{([['library','file','Library'],['browser','globe','Browser']] as const).map(([page,ic,label])=><button key={page} className={`ri ${m.page===page?'on':''}`} aria-label={label} onClick={()=>nav(page)}><Icon name={ic} size={17}/><span className="tip">{label}</span></button>)}<span className="gap"/><button className={`ri ${m.page==='terminal'?'on':''}`} aria-label="Terminal" onClick={()=>nav('terminal')}><Icon name="term" size={17}/><span className="tip">Terminal</span></button><button className={`ri ${m.page==='settings'?'on':''}`} aria-label="Settings" onClick={()=>nav('settings')}><Icon name="settings" size={17}/><span className="tip">Settings</span></button><button className="sr-only" onClick={onCommand}>Open command palette</button></nav>;
}
export function SessionItem({session:s,match}:{session:Session;match?:SessionSearchMatch}) {
  const {m,select}=useApp();
  const preview=sessionPreview(s,m.threads[s.id]);
  return <button className={`ss ${m.page==='session'&&m.selected===s.id?'on':''}`} onClick={()=>select(s.id)}><div className="ss-top"><SpaceTag space={s.runId?'code':mockProjects[s.pj]?.sp??'all'}/><span className="proj trunc">{s.projectName??mockProjects[s.pj]?.n}</span><span className="t">{s.runId?'LIVE':s.time}</span></div><div className="ss-title"><StatusDot status={s.st}/><Avatar id={s.ag} agent={m.agents[s.ag]} size={16}/><span className="trunc">{s.t}</span></div><div className="ss-prev"><span className="tg">{preview[0]}</span><span className="trunc">{preview[1]}</span></div>{match&&<small className="ss-prev" title={match.text}><span className="tg">{s.runId?'Live':'Sample'} · {match.category}</span><span className="trunc">{match.text}</span></small>}<div className="ss-chips">{s.loop&&<span className="ch vio"><Icon name="ref" size={10}/>{s.loop.join('/')}</span>}{s.prn&&<span className="ch">#{s.prn}{s.ci==='fail'?' ✕':s.ci==='ok'?' ✓':''}</span>}{s.add!==undefined&&<span className="ch"><span className="a">+{s.add}</span><span className="d">−{s.del}</span></span>}{s.srcN&&<span className="ch">{s.srcN} sources</span>}{s.words&&<span className="ch">{s.words} words</span>}</div></button>;
}
export function Sidebar(){
  const {m,update,openTask,select}=useApp();
  if(m.page==='settings')return <SettingsNavigation/>;
  const results=searchSessions(m);
  const visible=results.map(result=>result.session);
  const groups: [string,Session['st'][]][]=[['Needs you',NEEDY],['Working',['running','thinking','queued','starting','cancelling']],['Paused',['paused']],['Finished',['done','completed','cancelled','failed','interrupted']]];
  return <aside className="side" style={{gridTemplateRows:'auto auto minmax(0,1fr) auto auto'}}><div className="side-h"><h2><Icon name="msg" size={15}/>Sessions</h2><div className="split-btn"><button onClick={()=>openTask()}><Icon name="plus" size={13}/>New</button><button aria-label="New session options" onClick={()=>openTask()}><Icon name="down" size={12}/></button></div></div><label className="search"><Icon name="search" size={13}/><input id="session-search" aria-label="Search sessions" aria-describedby="session-search-scope" title={sessionSearchScope} placeholder="Search sessions, sources, files…" value={m.query} onChange={e=>update(d=>{d.query=e.target.value;})}/></label>
    <div className="slist"><p id="session-search-scope" className="demo-note" style={{padding:'8px 12px'}}>{sessionSearchScope}</p><button className={`ss home ${m.page==='home'?'on':''}`} onClick={()=>update(d=>{d.page='home';})}><span className="gl"><Icon name="home"/></span><span>Home<small>{visible.filter(s=>NEEDY.includes(s.st)).length} need you · {visible.filter(s=>['running','thinking'].includes(s.st)).length} working</small></span></button>{groups.map(([name,statuses])=>{const sessions=visible.filter(s=>statuses.includes(s.st));return sessions.length>0&&<div key={name}><div className={`grp ${name==='Needs you'?'amb':''}`}>{name}<span className="c">{sessions.length}</span></div>{sessions.map(s=><SessionItem session={s} match={results.find(result=>result.session.id===s.id)?.match} key={s.id}/>)}</div>;})}{!visible.length&&<p className="empty-note">No sessions match your search.</p>}</div>
    <RoutineSidebar/>
    <div className="side-f"><button onClick={()=>update(d=>{d.page='history';})}><Icon name="clock" size={12}/>Run history</button><span style={{marginLeft:'auto'}}>{Object.keys(m.runs).length} saved</span></div>

  </aside>;
}
export function SessionTabs(){
  const {m,update,select,openTask}=useApp();
  const setLayout=(layout:Layout)=>update(d=>{d.page='session';d.layout=layout;});
  return <nav className="tabs" aria-label="Session tabs">{m.open.map(id=>{const s=m.sessions.find(s=>s.id===id);return s&&<div className={`tab tab-with-close ${m.page==='session'&&m.selected===id?'on':''}`} key={id}><button className="tab-title" onClick={()=>select(id)}><StatusDot status={s.st}/><span className="trunc">{s.t}</span></button><button className="x" aria-label={`Close ${s.t}`} onClick={()=>update(d=>{d.open=d.open.filter(x=>x!==id);if(d.selected===id){d.page='home';d.selected=d.open[0]??'c1';}})}><Icon name="x" size={11}/></button></div>;})}<button className="addt" aria-label="New session" onClick={()=>openTask()}><Icon name="plus"/></button><div className="views"><LayoutMenu layout={m.layout} onSelect={setLayout}/></div></nav>;
}
export function StatusBar({children}:{children?:ReactNode}){const {m,info,workspace}=useApp();const count=Object.values(m.memory).reduce((n,g)=>n+g.xs.length,0);return <footer className="sbar"><span className="g">● {info?'Desktop':'Browser preview'}</span><span><Icon name="brain" size={11}/>{count} demo memories</span>{workspace&&<span className="trunc"><Icon name="folder" size={11}/>{workspace.name}</span>}{children}<span className="r">Sample crew/usage simulated · live Codex runs labeled · {m.sessions.filter(s=>['running','thinking'].includes(s.st)).length} working</span></footer>;}
