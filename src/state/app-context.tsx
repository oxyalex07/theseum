import type { TaskAttachment, InvocationId, TaskContextRequest } from '../../shared/task-context';
import { appendDemoReply, forkDemoSession, pauseDemoSession } from './session-actions';
import { readPreferences, writePreferences } from './preferences';
import { crewPlan, type CrewRequest, type CrewRoute } from '../../shared/crew';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useMemory } from './memory-context';
import { applyAgentRun, removeAgentRuns, restoreStartupSession, applyNewSessionDefaults, createModel, resolveSession, selectSession, type Model } from './model';
import type { AgentId, Message, Session } from '@/types';
import type { AgentAvailability, AppInfo, WorkspaceSummary, AgentProfile, AgentProfileLifecycleRequest, SaveAgentRequest, RunRetention, RunHistoryState, DeleteHistoryRequest } from '../../shared/bridge';
interface AppContextValue {
  taskAttachments:TaskAttachment[];setTaskAttachments:React.Dispatch<React.SetStateAction<TaskAttachment[]>>;taskInvocations:InvocationId[];setTaskInvocations:React.Dispatch<React.SetStateAction<InvocationId[]>>;
  crewRoute:CrewRoute|'single';setCrewRoute:(route:CrewRoute|'single')=>void;roleProfiles:NonNullable<CrewRequest['profiles']>;setRoleProfiles:(profiles:NonNullable<CrewRequest['profiles']>)=>void;openTask:(task?:string,route?:CrewRoute|'single')=>void;
  retention:RunRetention; rerunNotice:string;
  deleteHistory:(request:DeleteHistoryRequest)=>Promise<RunHistoryState>;setRetention:(retention:RunRetention)=>Promise<void>;prepareRerun:(id:string)=>Promise<void>;
  stopEverything:()=>Promise<void>; profileSelecting:boolean; executionLimitSeconds:number; profiles:AgentProfile[]; selectedProfile:AgentProfile|null; profileWarning:string;
  refreshProfiles:()=>Promise<void>; saveProfile:(request:SaveAgentRequest)=>Promise<AgentProfile>;
  changeProfile:(request:AgentProfileLifecycleRequest)=>Promise<void>;
  useProfile:(id:string|null)=>Promise<void>;
  m: Model; update: (fn: (draft: Model)=>void)=>void; notify: (message: string)=>void;
  toast: string; historyWarning:string; select: (id: string)=>void; send: (id: string,text: string)=>void;
  fork: (sourceId:string, through?:number, commit?:string)=>void;
  start: (agent: AgentId,text?: string)=>void; resolve: (id: string,action: 'approve'|'always'|'deny'|'retry')=>void;
  availability: AgentAvailability | null; executionMode:'live'|'demo'; setExecutionMode:(mode:'live'|'demo')=>void;
  refreshAgent:()=>Promise<void>; startLive:(task:string,useWorktree?:boolean,taskContext?:TaskContextRequest)=>Promise<boolean>; cancelLive:(id:string)=>Promise<void>; continueLive:(id:string,task:string)=>Promise<void>;
  info: AppInfo | null; workspace: WorkspaceSummary | null; chooseWorkspace: ()=>Promise<void>; exportMemory: ()=>Promise<void>;
}
const Context=createContext<AppContextValue|null>(null);
export function AppProvider({children}: {children: ReactNode}) {
  const {graph:memoryGraph,selectedIds,setSelectedIds,refresh:refreshMemory}=useMemory();
  const [taskAttachments,setTaskAttachments]=useState<TaskAttachment[]>([]),[taskInvocations,setTaskInvocations]=useState<InvocationId[]>([]);
  const [m,setModel]=useState(()=>createModel(location.search,readPreferences({getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value)})));
  const [toast,setToast]=useState('');
  const [profiles,setProfiles]=useState<AgentProfile[]>([]);
  const [profilesLoaded,setProfilesLoaded]=useState(false);
  const explicitProfileSelection=useRef(false);
  const [profileSelecting,setProfileSelecting]=useState(false);
  const [executionLimitSeconds,setExecutionLimitSeconds]=useState(1800);
  const choosingProfile=useRef(false);
  const [selectedProfile,setSelectedProfile]=useState<AgentProfile|null>(null);
  const [profileWarning,setProfileWarning]=useState('');
  const refreshProfiles=useCallback(async()=>{if(!window.theseus)return;const state=await window.theseus.listAgentProfiles();setProfiles(state.profiles);setProfilesLoaded(true);setProfileWarning(state.warning??'');},[]);
  useEffect(()=>{void refreshProfiles().catch(()=>setProfileWarning('Could not load saved agents. Restart the app or check local storage permissions.'));},[refreshProfiles]);
  const saveProfile=async(request:SaveAgentRequest)=>{
    if(!window.theseus)throw new Error('Saving agents requires the Electron app.');
    const profile=await window.theseus.saveAgentProfile(request);setProfiles(prev=>[...prev.filter(p=>p.id!==profile.id),profile]);
    setSelectedProfile(current=>current?.id===profile.id?profile:current);return profile;
  };
  const changeProfile=async(request:AgentProfileLifecycleRequest)=>{
    if(!window.theseus)throw new Error('Managing saved agents requires the Electron app.');
    if(choosingProfile.current)throw new Error('Wait for agent selection to finish.');
    const state=await window.theseus.changeAgentProfile(request);
    setProfiles(state.profiles);setProfileWarning(state.warning??'');
    setSelectedProfile(current=>current?state.profiles.find(p=>p.id===current.id&&!p.archivedAt)??null:null);
  };
  const [historyWarning,setHistoryWarning]=useState('');
  const [retention,setRetentionValue]=useState<RunRetention>('all');
  const [rerunNotice,setRerunNotice]=useState('');
  const deletedRuns=useRef(new Set<string>());
  const [info,setInfo]=useState<AppInfo|null>(null);
  const [availability,setAvailability]=useState<AgentAvailability|null>(null);
  const [crewRoute,setCrewRoute]=useState<CrewRoute|'single'>('single');
  const [roleProfiles,setRoleProfiles]=useState<NonNullable<CrewRequest['profiles']>>({});
  const openTask=(task?:string,route?:CrewRoute|'single')=>{if(route){explicitProfileSelection.current=true;setCrewRoute(route);}update(d=>{d.page='home';d.homeAgent=(Object.keys(d.agents).includes(String(d.settings.values.dag))?d.settings.values.dag:'orbit') as AgentId;if(task!==undefined)d.drafts.home=task;if(route&&route!=='single')d.homeAgent=crewPlan(route,task??d.drafts.home??'')[0];});requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Start a task"]')?.focus());};
  const [executionMode,setExecutionMode]=useState<'live'|'demo'>(window.theseus?'live':'demo');
  const [workspace,setWorkspace]=useState<WorkspaceSummary|null>(null);
  const timers=useRef(new Map<ReturnType<typeof setTimeout>,string>());
  const schedule=useCallback((id:string,fn:()=>void,delay:number)=>{const t=setTimeout(()=>{timers.current.delete(t);fn();},delay);timers.current.set(t,id);},[]);
  const update=useCallback((fn:(draft:Model)=>void,preserveStartup=false)=>setModel(prev=>{const next=structuredClone(prev);if(!preserveStartup)delete next.pendingStartupSession;fn(next);if(next.settings.values.dag!==prev.settings.values.dag)next.homeAgent=(Object.keys(next.agents).includes(String(next.settings.values.dag))?next.settings.values.dag:'orbit') as AgentId;return next;}),[]);
  const preferenceSnapshot=JSON.stringify({values:m.settings.values,keys:m.settings.keys,lastSession:m.lastSession});
  useEffect(()=>{try{writePreferences(localStorage,m.settings.values,m.lastSession,m.settings.keys);}catch{setToast('Could not save preferences on this device. Changes will be lost after restart.');}},[preferenceSnapshot]);
  const applyHistory=useCallback((state:RunHistoryState)=>{
    state.deletedIds.forEach(id=>deletedRuns.current.add(id));setRetentionValue(state.retention);setHistoryWarning(state.warning??'');
    update(d=>{removeAgentRuns(d,state.deletedIds);state.runs.filter(r=>!deletedRuns.current.has(r.id)).forEach(r=>applyAgentRun(d,r));},true);
  },[update]);
  const deleteHistory=async(request:DeleteHistoryRequest)=>{if(!window.theseus)throw new Error('History deletion requires the Electron app.');const state=await window.theseus.deleteRunHistory(request);applyHistory(state);return state;};
  const setRetention=async(value:RunRetention)=>{if(!window.theseus)throw new Error('Retention requires the Electron app.');const state=await window.theseus.setRunRetention(value);applyHistory(state);if(state.warning)throw new Error(state.warning);};
  const notify=useCallback((text:string)=>{setToast(text);},[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),2600);return()=>clearTimeout(t);},[toast]);
  useEffect(()=>()=>{timers.current.forEach((_,timer)=>clearTimeout(timer));timers.current.clear();},[]);
  useEffect(()=>{let active=true;window.theseus?.getAppInfo().then(data=>{if(active)setInfo(data);}).catch(()=>{if(active)notify('Desktop bridge unavailable');});return()=>{active=false;};},[notify]);
  useEffect(()=>window.theseus?.onDesktopState(state=>{if(state.warning)notify(state.warning);}),[notify]);
  const refreshAgent=useCallback(async()=>{
    if(!window.theseus)return;
    const state=await window.theseus.getExecutionState();setAvailability(state.availability);setWorkspace(state.workspace);setHistoryWarning(state.historyWarning??'');setExecutionLimitSeconds(state.executionLimitSeconds??1800);
    update(d=>{state.runs.filter(run=>!deletedRuns.current.has(run.id)).forEach(run=>applyAgentRun(d,run));restoreStartupSession(d);},true);
  },[update]);
  useEffect(()=>{
    if(!window.theseus)return;
    // Subscribe before reading state so reloads and very fast starts cannot lose updates.
    const unsubscribeHistory=window.theseus.onRunHistory(applyHistory);
    void window.theseus.getRunHistory().then(applyHistory).catch(()=>notify('Could not read run retention policy.'));
    const unsubscribe=window.theseus.onAgentRun(run=>{if(deletedRuns.current.has(run.id))return;if(run.persistenceError)setHistoryWarning(run.persistenceError);update(d=>applyAgentRun(d,run),true);});
    void refreshAgent().catch(()=>notify('Could not check Codex. Use Refresh to try again.'));
    return ()=>{unsubscribe();unsubscribeHistory();};
  },[refreshAgent,update,notify,applyHistory]);
  const useProfile=async(id:string|null,fromDefault=false)=>{
    if(!fromDefault){explicitProfileSelection.current=true;update(()=>{});}
    if(choosingProfile.current)throw new Error('Wait for agent selection to finish.');
    if(!id){setSelectedProfile(null);setCrewRoute('single');return;}
    if(!window.theseus)throw new Error('Saved agents require the Electron app.');
    choosingProfile.current=true;setProfileSelecting(true);
    try{
      const result=await window.theseus.useAgentProfile(id);setCrewRoute('single');setSelectedProfile(result.profile);setWorkspace(result.workspace);setExecutionMode('live');void refreshMemory();
      if(result.warning)notify(result.warning);
    }finally{choosingProfile.current=false;setProfileSelecting(false);}
  };
  const defaultProfileApplied=useRef<string|undefined>(undefined);
  useEffect(()=>{
    const value=String(m.settings.values.dag);
    if(defaultProfileApplied.current===value||!window.theseus||!profilesLoaded||explicitProfileSelection.current||crewRoute!=='single')return;
    defaultProfileApplied.current=value;
    if(value.startsWith('profile:')){const id=value.slice(8);if(profiles.some(p=>p.id===id&&!p.archivedAt))void useProfile(id,true).catch(()=>{setSelectedProfile(null);notify('Default saved agent could not be selected. Codex defaults are selected.');});else {setSelectedProfile(null);notify('Default saved agent is unavailable. Codex defaults are selected.');}}else setSelectedProfile(null);
  },[profiles,profilesLoaded,m.settings.values.dag]);
  const prepareRerun=async(id:string)=>{
    explicitProfileSelection.current=true;
    if(!window.theseus)throw new Error('Reruns require the Electron app.');
    if(choosingProfile.current)throw new Error('Wait for agent selection to finish.');
    const result=await window.theseus.prepareRunRerun(id);
    const latest=await window.theseus.listAgentProfiles();setProfiles(latest.profiles);
    const prior=result.run.agentConfiguration?.profile;
    const current=prior?latest.profiles.find(p=>p.id===prior.id&&!p.archivedAt):undefined;
    setCrewRoute('single');setSelectedProfile(current??null);setWorkspace(result.workspace);setExecutionMode('live');setSelectedIds([]);setTaskAttachments([]);setTaskInvocations([]);
    const pages=await window.theseus.getBrowsingState();
    for(const pageId of pages.selectedIds)await window.theseus.browserCommand({action:'select-extract',id:pageId,selected:false});
    await refreshMemory();
    setRerunNotice(`Review rerun: this starts a new run in ${result.workspace.path}. Review the task and configuration below, then select current memories and page context again. ${prior?current?(current.updatedAt===prior.updatedAt?'The saved agent is selected.':'The saved agent changed; its current configuration is shown.'):'The original agent is unavailable; Codex defaults are selected.':'Codex defaults use the current runtime.'} Earlier file changes remain. This does not resume the original conversation.`);
    update(d=>{d.drafts.home=result.run.task;d.page='home';});
  };
  useEffect(()=>{setTaskAttachments([]);setTaskInvocations([]);},[workspace?.id]);
  const startLive=async(task:string,useWorktree=false,taskContext?:TaskContextRequest):Promise<boolean>=>{
    if(choosingProfile.current){notify('Wait for agent selection to finish.');return false;}
    if(!window.theseus){notify('Live Codex execution requires the Electron app.');return false;}
    if(!workspace){notify('Choose a project folder first.');return false;}
    try{
      const browsing=await window.theseus.getBrowsingState();
      const run=await window.theseus.startAgentRun({...(crewRoute!=='single'?{crew:{route:crewRoute,profiles:roleProfiles}}:{}),workspaceId:workspace.id,task,useWorktree,...(taskContext?{taskContext}:{}),pageIds:browsing.selectedIds,memoryIds:selectedIds,memoryRevision:memoryGraph.revision,...(crewRoute==='single'&&selectedProfile?{profileId:selectedProfile.id,profileUpdatedAt:selectedProfile.updatedAt}:{})});
      update(d=>{applyAgentRun(d,run);selectSession(d,run.id);applyNewSessionDefaults(d);d.showInspector=true;});setSelectedIds([]);setTaskAttachments([]);setTaskInvocations([]);setRerunNotice('');return true;
    }catch(error){notify(error instanceof Error?error.message:'Could not start Codex.');return false;}
  };
  const continueLive=useCallback(async(id:string,task:string)=>{
    if(!window.theseus)throw new Error('Live follow-ups require the Electron app.');
    const current=m.runs[id];if(!current)throw new Error('Run not found.');
    const run=await window.theseus.continueAgentRun({runId:id,task,expectedRevision:current.revision});
    update(d=>applyAgentRun(d,run));
  },[m.runs,update]);
  const cancelLive=async(id:string)=>{
    try{const run=await window.theseus?.cancelAgentRun(id);if(run)update(d=>applyAgentRun(d,run));}
    catch(error){notify(error instanceof Error?error.message:'Could not cancel the run.');}
  };
  const stopEverything=async()=>{
    // Only running/thinking demos have a resumable pause. Cancel replies for
    // all other states without replacing their pending approval/result status.
    const resumable=new Set(m.sessions.filter(s=>!s.runId&&['running','thinking','paused'].includes(s.st)).map(s=>s.id));
    for(const [timer,id] of timers.current)if(!resumable.has(id)){clearTimeout(timer);timers.current.delete(timer);}
    update(d=>{d.sessions.forEach(s=>pauseDemoSession(d,s.id));});
    if(window.theseus)await window.theseus.stopAllExecution();
    notify(window.theseus?'All local execution stopped. Existing file changes were kept.':'Demo activity stopped.');
  };
  const select=useCallback((id:string)=>update(d=>selectSession(d,id)),[update]);
  const send=useCallback((id:string,text:string)=>{
    if(!text.trim())return;
    const live=m.sessions.find(s=>s.id===id)?.runId;
    if(live){void continueLive(live,text).catch(error=>notify(error instanceof Error?error.message:'Could not continue Codex.'));return;}
    if(!m.sessions.some(s=>s.id===id&&!s.runId&&s.st!=='paused')){notify('Resume this demo before sending a message.');return;}
    update(d=>{(d.threads[id]??=[]).push({r:'you',t:text.trim(),plain:true});});
    schedule(id,()=>update(d=>{const s=d.sessions.find(s=>s.id===id);if(s)appendDemoReply(d,id,{r:'ag',plain:true,t:`Demo reply from ${d.agents[s.ag].n}: I’ll fold “${text.slice(0,80)}” into the plan. No agent is running.`,tools:[{tag:'MEM',title:'checked demo preferences',meta:'simulated'}]});}),900);
  },[update,schedule,m.sessions,notify,continueLive]);
  const start=useCallback((agent:AgentId,text='')=>{
    const id=crypto.randomUUID();
    update(d=>{
      const session: Session={id,ag:agent,pj:['scout','quill'].includes(agent)?'agents':'habit',t:text?text.slice(0,48):`New session with ${d.agents[agent].n}`,st:'thinking',time:'now',mem:3,prev:['THINK','demo plan']};
      d.sessions.unshift(session);d.threads[id]=[{sys:'Demo session · simulated activity'},...(text?[{r:'you',t:text,plain:true} as Message]:[])];
      selectSession(d,id);applyNewSessionDefaults(d);
    });
    schedule(id,()=>update(d=>{const s=d.sessions.find(s=>s.id===id);if(s)appendDemoReply(d,id,{r:'ag',t:'Starting a simulated plan. No agent is running; use Live mode to execute a task.',plain:true},true);}),900);
  },[update,schedule]);
  const fork=useCallback((sourceId:string,through?:number,commit?:string)=>{
    const id=crypto.randomUUID();
    update(d=>{if(forkDemoSession(d,sourceId,id,through,commit)){selectSession(d,id);applyNewSessionDefaults(d);}});
  },[update]);
  const resolve=useCallback((id:string,action:'approve'|'always'|'deny'|'retry')=>{
    if(m.sessions.find(s=>s.id===id)?.runId){notify('Live Codex uses a fixed non-interactive policy; demo approval controls do not apply.');return;}
    update(d=>resolveSession(d,id,action));notify(action==='deny'?'Denied in demo mode':action==='retry'?'Demo retry queued':'Approved in demo mode · no command executed');
  },[update,notify,m.sessions]);
  useEffect(()=>{
    if(new URLSearchParams(location.search).has('static'))return;
    const timer=setInterval(()=>update(d=>{
      const s=d.sessions.find(s=>['r1','c5'].includes(s.id)&&['running','thinking'].includes(s.st));if(!s)return;
      const th=d.threads[s.id];th.push({r:'ag',plain:true,t:'Demo activity: updated the working notes.',tools:[{tag:'READ',title:'sample workspace notes',meta:'simulated'}]});if(th.length>18)th.splice(1,1);
      if(s.loop&&s.loop[0]<s.loop[1])s.loop[0]++;s.time='now';
    }),6000);return()=>clearInterval(timer);
  },[update]);
  const chooseWorkspace=async()=>{
    if(!window.theseus){notify('Workspace selection is available in Electron. Browser preview uses mock projects.');return;}
    try{const result=await window.theseus.selectWorkspace();if(result){setWorkspace(result);void refreshMemory();notify('Project selected · Codex can edit it when you start a live task');}}catch{notify('Could not read the selected workspace');}
  };
  const exportMemory=async()=>{
    const data=Object.fromEntries(Object.entries(m.memory).map(([k,g])=>[k,g.xs.map(x=>typeof x==='string'?x:x.t)]));
    if(!window.theseus){notify('Memory export is available in the Electron app.');return;}
    try{const result=await window.theseus.exportMemory(data);if(result.saved)notify('Memory exported');}catch{notify('Could not export memory');}
  };
  return <Context.Provider value={{taskAttachments,setTaskAttachments,taskInvocations,setTaskInvocations,crewRoute,setCrewRoute,roleProfiles,setRoleProfiles,openTask,stopEverything,retention,rerunNotice,deleteHistory,setRetention,prepareRerun,profileSelecting,executionLimitSeconds,profiles,selectedProfile,profileWarning,refreshProfiles,saveProfile,changeProfile,useProfile,m,update,notify,toast,historyWarning,select,send,start,fork,resolve,info,workspace,chooseWorkspace,exportMemory,availability,executionMode,setExecutionMode,refreshAgent,startLive,cancelLive,continueLive}}>{children}</Context.Provider>;
}
export function useApp(){const ctx=useContext(Context);if(!ctx)throw new Error('AppProvider missing');return ctx;}
