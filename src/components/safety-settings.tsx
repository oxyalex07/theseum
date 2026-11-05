import { useEffect, useState } from 'react';
import type { SafetyState } from '../../shared/safety';
import { useApp } from '@/state/app-context';
import { Button } from './ui/button';

export function SafetySettings(){
  const {stopEverything,refreshAgent}=useApp();
  const [state,setState]=useState<SafetyState|null>(null);
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false),[stopping,setStopping]=useState(false);
  const [stopped,setStopped]=useState(false);
  useEffect(()=>{let active=true;
    window.theseus?.getSafetyState().then(value=>{if(active)setState(value);}).catch(()=>{if(active)setError('Could not load Safety settings. Reopen Settings to retry.');});
    return()=>{active=false;};
  },[]);
  const save=async(timeoutSeconds:number)=>{
    if(!state||!window.theseus)return;
    setSaving(true);setError('');
    try{setState(await window.theseus.saveSafetyPolicy({...state.policy,timeoutSeconds}));void refreshAgent().catch(()=>setError('Policy saved. Could not refresh the task composer; reopen the app to refresh its limit display.'));}
    catch(error){setError(error instanceof Error?error.message:'Could not save Safety settings.');}
    finally{setSaving(false);}
  };
  const stop=async()=>{
    setStopping(true);setStopped(false);setError('');
    try{await stopEverything();setStopped(true);}
    catch(error){setError(error instanceof Error?error.message:'Could not stop execution. Try again.');}
    finally{setStopping(false);}
  };
  return <div className="safety-settings">
    <p className="why">{window.theseus?'Policies apply to new live Codex tasks. Active tasks keep their saved policy.':'Live policies require the desktop app. Browser preview cannot configure execution.'}</p>
    {(error||state?.error)&&<p role="alert" className="run-error">{error||state?.error}</p>}
    <dl className="run-details">
      <dt>Approvals</dt><dd>Operations requiring sandbox escalation are denied. Pending approval decisions are unavailable in this execution mode.</dd>
      <dt>Ask first</dt><dd><Button size="sm" disabled>Unavailable</Button> Per-action rules for shell, installs, push, messages, deletes, and agents are unsupported.</dd>
      <dt>Command allowlist</dt><dd><Button size="sm" disabled>Unavailable</Button> Commands inside the sandbox may run without asking. Demo approvals never grant live permissions.</dd>
      <dt>Sandbox network</dt><dd>Blocked for agent commands. Domain allowlists and unrestricted network are unavailable. Browser and configured MCP tools have separate access controls; model service connections remain available.</dd>
      <dt>Run time limit</dt><dd><select aria-label="Run time limit" disabled={!state||!!state.error||saving||!state.capabilities.runTimeout} value={state?.policy.timeoutSeconds??1800} onChange={event=>void save(Number(event.target.value))}>
        {[60,300,600,1800,...(state&&![60,300,600,1800].includes(state.policy.timeoutSeconds)?[state.policy.timeoutSeconds]:[])].sort((a,b)=>a-b).map(seconds=><option key={seconds} value={seconds}>{seconds%60===0?`${seconds/60} ${seconds===60?'minute':'minutes'}`:`${seconds} seconds`}</option>)}
      </select>{saving&&<span role="status"> Saving…</span>}<p className="demo-note">The shortest global, agent, or app launch limit applies to the whole run. Per-step limits are unsupported. Manual Terminal commands use their own 10-minute limit.</p></dd>
    </dl>
    <p className="why">Stop all ends live Codex tasks, manual Terminal commands, and demo activity in this app. Existing file changes are kept. A saved Codex conversation can be continued explicitly after execution stops. External MCP services and other applications keep running.</p>
    <Button size="sm" disabled={stopping} onClick={()=>void stop()}>{stopping?'Stopping execution…':window.theseus?'Stop all execution':'Stop demo activity'}</Button>
    {stopped&&<p role="status">{window.theseus?'All local execution stopped.':'Demo activity stopped.'}</p>}
  </div>;
}
