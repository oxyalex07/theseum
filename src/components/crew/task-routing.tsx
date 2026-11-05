import { crewPlan, crewRoutes, readOnlyRole, roleInstructions, type CrewRoute } from '../../../shared/crew';
import { useApp } from '@/state/app-context';

export function TaskRouting({disabled}:{disabled:boolean}) {
  const {m,crewRoute,setCrewRoute,roleProfiles,setRoleProfiles,profiles,executionLimitSeconds}=useApp();
  const roles=crewRoute==='single'?[]:crewPlan(crewRoute,m.drafts.home??'');
  return <div className="profile-effective">
    <label htmlFor="crew-route" className="mr-3">Routing</label>
    <select id="crew-route" value={crewRoute} disabled={disabled} onChange={e=>setCrewRoute(e.target.value as CrewRoute|'single')}>
      <option value="single">Single agent · selected configuration</option>
      {crewRoutes.map(route=><option key={route} value={route}>
        {route==='auto'?'Theseus · automatic routing':route==='feature'?'Build → Review':route==='research'?'Research → Write':`${m.agents[route].n} · ${m.agents[route].role}`}
      </option>)}
    </select>
    {roles.length>0&&<>
      <p className="demo-note mt-3">{roles.map(role=>m.agents[role].n).join(' → ')} · {roles.length>1?'Each step waits for successful completion and receives the previous step’s final messages. Steps share the project folder. A failed or cancelled prerequisite stops dependent steps.':'One owned Codex execution with the role instructions below.'}</p>
      {roles.map(role=>{
        const profile=profiles.find(p=>p.id===roleProfiles[role]?.id);
        return <div key={role} className="mt-3">
          <label htmlFor={`crew-${role}`} className="mr-3">{m.agents[role].n} · {m.agents[role].role}</label>
          <select id={`crew-${role}`} value={roleProfiles[role]?.id??''} disabled={disabled} onChange={e=>{
            const next={...roleProfiles};const selected=profiles.find(p=>p.id===e.target.value);
            if(selected)next[role]={id:selected.id,updatedAt:selected.updatedAt};else delete next[role];
            setRoleProfiles(next);
          }}>
            <option value="">Codex defaults + role instructions</option>
            {profiles.filter(p=>!p.archivedAt).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p className="demo-note mt-3">{readOnlyRole(role)?'read-only':profile?.sandbox??'workspace-write'} · {profile?.model??'Runtime default model'} · {profile?.reasoningEffort??'Default reasoning'} · approvals never · {Math.min(profile?.timeoutSeconds??1800,executionLimitSeconds)}s limit · {profile?.memory??'personal-project'} memory</p>
          <details className="mt-3"><summary>Role & agent instructions</summary><p className="demo-note mt-3">{roleInstructions[role]}</p>{profile&&<pre className="whitespace-pre-wrap break-words text-xs mt-3 max-h-48 overflow-auto">{profile.instructions||'No additional agent instructions'}</pre>}</details>
        </div>;
      })}
    </>}
  </div>;
}
