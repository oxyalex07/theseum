import { useState } from 'react';
import { useApp } from '@/state/app-context';
import { useMemory } from '@/state/memory-context';
import { profileInitial, useLocalProfile } from '../profile/local-profile';
import { Icon } from '../common';
import { Button } from '../ui/button';
export function ProfilePage(){
  const {profile,save}=useLocalProfile();
  const {profiles,m,availability,workspace,update}=useApp();const {graph}=useMemory();
  const [name,setName]=useState(profile.name),[bio,setBio]=useState(profile.bio),[error,setError]=useState(''),[saved,setSaved]=useState(false);
  const dirty=name!==profile.name||bio!==profile.bio;
  const edit=()=>{setError('');setSaved(false);};
  return <div className="page"><div className="page-w profile-page"><div className="profile-heading"><div><h1><Icon name="users" size={21}/>Profile</h1><p>Your local identity and workspace overview.</p></div><Button onClick={()=>update(d=>{d.page='home';})}>Back to Home</Button></div>
    <section className="profile-identity"><span className="pic profile-avatar" aria-hidden="true">{profileInitial(profile.name)}</span><div><h2>{profile.name}</h2><span className="pill q">Local profile</span><p>{profile.bio||'A little space for the person behind the agents.'}</p></div></section>
    <div className="profile-columns"><section className="profile-section"><h2>Personal details</h2><p className="profile-hint">These details stay on this device. They aren’t sent to agents or linked to your runtime’s login.</p><form onSubmit={e=>{e.preventDefault();setSaved(false);try{save({name,bio});setName(name.trim());setBio(bio.trim());setError('');setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Could not save your profile. Try again.');}}}>
      <label htmlFor="profile-name">Display name</label><input id="profile-name" value={name} maxLength={60} required aria-invalid={!!error} onChange={e=>{setName(e.target.value);edit();}}/>
      <label htmlFor="profile-bio">About you <span className="muted">· optional</span></label><textarea id="profile-bio" value={bio} maxLength={280} rows={4} placeholder="What are you working on?" onChange={e=>{setBio(e.target.value);edit();}}/><small className="profile-counter">{bio.length}/280</small>
      {error&&<p role="alert" className="run-error">{error}</p>}{saved&&<p role="status" className="profile-saved"><Icon name="check" size={13}/>Profile saved on this device.</p>}
      <div className="flex justify-end gap-2 mt-5"><Button type="button" disabled={!dirty} onClick={()=>{setName(profile.name);setBio(profile.bio);edit();}}>Cancel changes</Button><Button type="submit" variant="primary" disabled={!dirty}>Save profile</Button></div>
    </form></section>
    <aside><section className="profile-section"><h2>Your workspace</h2><p className="profile-hint">Real saved data · sample previews excluded</p><div className="profile-links">{[['users','Saved agents',String(profiles.filter(p=>!p.archivedAt).length),'crew'],['brain','Current memories',String(graph.records.filter(r=>r.status==='current').length),'memory'],['clock','Run history',String(Object.keys(m.runs).length),'history']].map(([icon,label,count,page])=><button key={page} onClick={()=>update(d=>{d.page=page as 'crew'|'memory'|'history';})}><Icon name={icon} size={15}/><span>{label}</span><b>{count}</b><Icon name="right" size={12}/></button>)}</div></section>
      <section className="profile-section"><h2>Coding runtime</h2><dl className="run-details"><dt>Runtime</dt><dd>Codex</dd><dt>Availability</dt><dd>{!window.theseus?'Desktop app required':!availability?'Checking…':availability.installed?'Installed':'Unavailable'}</dd><dt>Authentication</dt><dd>{availability?.authenticated?'Verified by runtime':'Not verified'}</dd><dt>Project</dt><dd>{workspace?.name??'No project selected'}</dd></dl><p className="profile-hint">Authentication belongs to the installed runtime. Credentials are never part of this profile.</p><Button size="sm" onClick={()=>update(d=>{d.page='settings';d.section='general';d.settingsQuery='';})}><Icon name="settings" size={13}/>App settings</Button></section>
    </aside></div>
  </div></div>;
}
