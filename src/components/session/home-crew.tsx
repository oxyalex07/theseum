import { useState } from 'react';
import type { AgentProfile } from '../../../shared/bridge';
import { isActiveRun } from '../../../shared/bridge';
import { statusLabels } from '@/types';
import { AgentEditor } from '../pages/agents';
import { sampleAgents } from '@/data/sample-preview';
import { useApp } from '@/state/app-context';
import { useSamplePreview } from '@/state/sample-preview';
import { Icon, SectionHeading } from '../common';
import { ProfileMark } from '../profile-mark';
import { Button } from '../ui/button';

export function HomeCrew(){
  const {m,profiles,selectedProfile,profileSelecting,profileWarning,useProfile,update,notify,select,openTask,setExecutionMode}=useApp();
  const {samples}=useSamplePreview();
  const [query,setQuery]=useState('');
  const [editor,setEditor]=useState<{profile?:AgentProfile}|null>(null);
  const activeProfiles=profiles.filter(profile=>!profile.archivedAt);
  const match=(profile:AgentProfile)=>`${profile.name} ${profile.description}`.toLowerCase().includes(query.trim().toLowerCase());
  const visible=activeProfiles.filter(match);
  const manage=()=>update(d=>{d.page='crew';});
  const choose=async(id:string)=>{
    try{
      await useProfile(id);
      update(d=>{d.page='home';});
      requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Start a task"]')?.focus());
    }catch(error){notify(error instanceof Error?error.message:'Could not select agent. Try again from Manage.');}
  };
  return <div className="sec">
    <SectionHeading icon="users" title={samples?'Sample crew':'Your crew'} action={<button onClick={manage}>Manage</button>}/>
    <div className="panel-toolbar"><label className="panel-search"><Icon name="search" size={13}/><input aria-label="Search crew" placeholder="Find an agent…" value={query} onChange={e=>setQuery(e.target.value)}/></label><Button size="sm" disabled={samples||!window.theseus} onClick={()=>setEditor({})}>New agent</Button></div>
    {!samples&&<div className="panel-route-actions"><span>Prepare a crew task</span>{([['feature','Build → Review'],['research','Research → Write']] as const).map(([route,label])=><Button key={route} size="sm" onClick={()=>{setExecutionMode('live');openTask(undefined,route);}}>{label}</Button>)}</div>}
    {!samples&&profileWarning&&<p className="run-error" role="alert">{profileWarning}</p>}
    {!samples&&!activeProfiles.length?<div className="home-panel-empty">
      <Icon name="users" size={22}/><b>No saved agents yet</b>
      <p>Create an agent to save Codex instructions, permissions, and a default project. Manage also lets you restore archived agents.</p>
      <Button size="sm" onClick={manage}>Create your first agent</Button>
    </div>:<div className="agents-mini">{samples?sampleAgents.filter(match).map(profile=><button className="am" key={profile.id} onClick={manage}>
      <ProfileMark profile={profile} size={26}/><span style={{minWidth:0,flex:1}}><b>{profile.name}</b><span className="trunc" style={{display:'block',fontSize:11,color:'var(--meta)'}}>{profile.description}</span></span><small className="muted">Sample</small>
    </button>):visible.map(profile=><div className="panel-agent" key={profile.id}><button className="am" key={profile.id} aria-pressed={selectedProfile?.id===profile.id} disabled={profileSelecting} onClick={()=>void choose(profile.id)}>
      <ProfileMark profile={profile} size={26}/><span style={{minWidth:0,flex:1}}><b>{profile.name}</b><span className="trunc" style={{display:'block',fontSize:11,color:'var(--meta)'}}>{profile.description||'Reusable Codex configuration'}</span></span><small className="muted">{selectedProfile?.id===profile.id?'Selected':'Use agent'}</small>
    </button><details><summary>Configuration & activity</summary><dl className="run-details"><dt>Model</dt><dd>{profile.model??'Runtime default'}</dd><dt>Permissions</dt><dd>{profile.sandbox}</dd><dt>Time limit</dt><dd>{profile.timeoutSeconds}s</dd><dt>Memory</dt><dd>{profile.memory}</dd></dl><details><summary>Instructions</summary><p className="panel-pre">{profile.instructions||'No additional instructions.'}</p></details><Button size="sm" onClick={()=>setEditor({profile})}>Edit agent</Button><h4>Recent runs</h4>{Object.values(m.runs).filter(run=>run.agentConfiguration?.profile?.id===profile.id).sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).slice(0,3).map(run=><button className="panel-run-link" key={run.id} onClick={()=>{select(run.id);update(d=>{d.layout='focus';d.showInspector=true;});}}><span>{run.task.slice(0,80)}</span><small>{statusLabels[run.status]}{isActiveRun(run.status)?' · live':''}</small></button>)}{!Object.values(m.runs).some(run=>run.agentConfiguration?.profile?.id===profile.id)&&<p className="demo-note">No runs with this saved agent yet.</p>}</details></div>)}</div>}
    {query&&!(samples?sampleAgents.filter(match):visible).length&&<p className="empty-note">No agents match your search.</p>}
    {editor&&<AgentEditor profile={editor.profile} onClose={()=>setEditor(null)}/>}
    {!samples&&profileSelecting&&<p className="demo-note" role="status">Selecting saved agent…</p>}
  </div>;
}
