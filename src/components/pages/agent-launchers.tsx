import { useEffect, useState } from 'react';
import type { AgentLauncher, LauncherState, SaveLauncherRequest } from '../../../shared/agent-launchers';
import { Button } from '../ui/button';
import { Icon } from '../common';

const empty:SaveLauncherRequest={name:'',description:'',repository:'',runtime:'claude',command:'',folderChoice:null};
const runtimeName={claude:'Claude Code',codex:'Codex',other:'Other CLI'};
const message=(e:unknown)=>e instanceof Error?e.message:'Something went wrong. Try again.';

export function AgentLaunchersPanel(){
  const [state,setState]=useState<LauncherState>({launchers:[],supported:false});
  const [loading,setLoading]=useState(!!window.theseus),[error,setError]=useState(''),[status,setStatus]=useState('');
  const [search,setSearch]=useState(''),[runtime,setRuntime]=useState('all');
  const [editor,setEditor]=useState<{record?:AgentLauncher}|null>(null);
  const [busy,setBusy]=useState<string|null>(null),[removing,setRemoving]=useState<string|null>(null);
  const refresh=async()=>{if(!window.theseus)return;setLoading(true);setError('');try{setState(await window.theseus.getAgentLaunchers());}catch(e){setError(message(e));}finally{setLoading(false);}};
  useEffect(()=>{void refresh();},[]);
  const visible=state.launchers.filter(r=>(runtime==='all'||r.runtime===runtime)&&`${r.name} ${r.description} ${r.repository} ${r.command}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a,b)=>(b.lastLaunchedAt??'').localeCompare(a.lastLaunchedAt??'')||a.name.localeCompare(b.name));
  const action=async(record:AgentLauncher,remove=false)=>{
    if(!window.theseus)return;setBusy(record.id);setError('');setStatus('');
    try{setState(await (remove?window.theseus.removeAgentLauncher(record.id,record.updatedAt):window.theseus.launchAgentLauncher(record.id,record.updatedAt)));setRemoving(null);setStatus(remove?`${record.name} removed from your library.`:`Sent ${record.name} to Terminal. Continue there to use the agent.`);}catch(e){setError(message(e));}finally{setBusy(null);}
  };
  return <section className="launcher-panel" aria-label="GitHub agent launchers">
    <div className="launcher-heading"><div><h2>Your GitHub agents, one launch away</h2><p>Keep the tools and agent setups you’ve downloaded together. Save their command once, then launch from here.</p></div><Button variant="primary" disabled={!window.theseus||loading||!!state.warning} onClick={()=>{setEditor({});setStatus('');}}><Icon name="plus" size={14}/>Add launcher</Button></div>
    {!window.theseus&&<p className="demo-note">Open the desktop app to save and launch agents.</p>}
    {window.theseus&&!loading&&!state.supported&&<p className="demo-note">You can organize launchers here. Opening an interactive terminal currently requires macOS.</p>}
    {state.warning&&<p className="run-error" role="alert">{state.warning}</p>}
    {error&&<div className="flex items-center gap-3"><p className="run-error" role="alert">{error}</p><Button size="sm" disabled={!!busy} onClick={()=>void refresh()}>Refresh library</Button></div>}
    <p className="launcher-status" role="status">{status}</p>
    {editor?<LauncherEditor key={editor.record?.id??'new'} record={editor.record} onClose={()=>setEditor(null)} onSave={next=>{setState(next);setEditor(null);setStatus('Launcher saved.');}}/>:<>
      <div className="resource-toolbar"><label className="search"><Icon name="search"/><input aria-label="Search agent launchers" placeholder="Search agents, repositories, commands…" value={search} onChange={e=>setSearch(e.target.value)}/></label><label className="launcher-runtime-filter"><span className="sr-only">Filter by runtime</span><select aria-label="Filter by runtime" value={runtime} onChange={e=>setRuntime(e.target.value)}><option value="all">All runtimes</option>{Object.entries(runtimeName).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label><span>{visible.length} {visible.length===1?'launcher':'launchers'}</span></div>
      {loading?<p role="status" className="demo-note">Loading your launchers…</p>:visible.length?<div className="launcher-list">{visible.map(record=><article className="launcher-row" key={record.id} data-launcher-id={record.id}>
        <span className="resource-icon"><Icon name="term" size={20}/></span><div className="launcher-info"><div className="launcher-title"><h3>{record.name}</h3><span>{runtimeName[record.runtime]}</span></div>{record.description&&<p>{record.description}</p>}<button className="launcher-source" onClick={()=>void window.theseus?.openBrowserUrl(record.repository).catch(e=>setError(message(e)))}><Icon name="branch" size={12}/>{record.repository.replace('https://github.com/','')}<Icon name="ext" size={11}/></button><pre className="launcher-command">{record.command}</pre><div className="launcher-folder"><Icon name="folder" size={12}/><span>{record.folder}</span></div>{record.lastLaunchedAt&&<small className="launcher-last">Last sent to Terminal {new Date(record.lastLaunchedAt).toLocaleString()}</small>}</div>
        <div className="launcher-actions"><Button variant="primary" disabled={!state.supported||!!busy||!!state.warning} onClick={()=>void action(record)}><Icon name="rocket" size={13}/>{busy===record.id?'Working…':'Launch'}</Button><div className="flex gap-2"><Button size="sm" disabled={!!busy||!!state.warning} onClick={()=>{setEditor({record});setStatus('');}}>Edit</Button><Button size="sm" aria-label={`Remove ${record.name}`} disabled={!!busy||!!state.warning} onClick={()=>setRemoving(record.id)}><Icon name="trash" size={13}/></Button></div>{removing===record.id&&<div className="launcher-remove"><p>Remove this shortcut? Files stay on your computer.</p><Button size="sm" variant="destructive" disabled={!!busy} onClick={()=>void action(record,true)}>Remove launcher</Button><Button size="sm" disabled={!!busy} onClick={()=>setRemoving(null)}>Keep</Button></div>}</div>
      </article>)}</div>:<div className="resource-empty"><Icon name="branch" size={30}/><h3>{state.launchers.length?'No matching launchers':'Stop hunting for that command'}</h3><p>{state.launchers.length?'Try a different search or runtime.':'Add a GitHub repository, choose its local working folder, and save the command you normally type in Terminal.'}</p>{!state.launchers.length&&<Button disabled={!window.theseus||!!state.warning} onClick={()=>setEditor({})}>Add your first launcher</Button>}</div>}
      <p className="demo-note mt-5">Launchers use software you’ve already installed. Commands open in macOS Terminal with your normal CLI login and permissions. Theseus does not track or stop these external sessions.</p>
    </>}
  </section>;
}
function LauncherEditor({record,onClose,onSave}:{record?:AgentLauncher;onClose:()=>void;onSave:(state:LauncherState)=>void}){
  const [draft,setDraft]=useState<SaveLauncherRequest>(record?{name:record.name,description:record.description,repository:record.repository,runtime:record.runtime,command:record.command,id:record.id,expectedUpdatedAt:record.updatedAt,folderChoice:null}:{...empty});
  const [folder,setFolder]=useState(record?.folder??''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[picking,setPicking]=useState(false);
  const change=<K extends keyof SaveLauncherRequest>(key:K,value:SaveLauncherRequest[K])=>setDraft(p=>({...p,[key]:value}));
  const pick=async()=>{if(!window.theseus)return;setPicking(true);setError('');try{const choice=await window.theseus.selectAgentFolder();if(choice){change('folderChoice',choice.id);setFolder(choice.path);}}catch(e){setError(message(e));}finally{setPicking(false);}};
  const save=async(e:React.FormEvent)=>{e.preventDefault();if(!window.theseus)return;setSaving(true);setError('');try{onSave(await window.theseus.saveAgentLauncher(draft));}catch(e){setError(message(e));}finally{setSaving(false);}};
  return <form className="launcher-editor" onSubmit={e=>void save(e)}><div className="launcher-editor-intro"><h3>{record?'Edit launcher':'Add a GitHub launcher'}</h3><p>Use the repository’s instructions to install your tool first. Saving here creates a shortcut; it doesn’t download or run anything.</p></div><fieldset disabled={saving} className="agent-fields launcher-fields">
    <div className="launcher-field-pair"><div><label htmlFor="launcher-name">Name</label><input id="launcher-name" autoFocus required maxLength={80} value={draft.name} placeholder="e.g. My code reviewer" onChange={e=>change('name',e.target.value)}/></div><div><label htmlFor="launcher-runtime">Runs with</label><select id="launcher-runtime" value={draft.runtime} onChange={e=>change('runtime',e.target.value as AgentLauncher['runtime'])}>{Object.entries(runtimeName).map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></div></div>
    <div><label htmlFor="launcher-repository">GitHub repository</label><input id="launcher-repository" type="url" required maxLength={500} value={draft.repository} placeholder="https://github.com/owner/repo" onChange={e=>change('repository',e.target.value)}/></div>
    <div><label htmlFor="launcher-description">Description · optional</label><input id="launcher-description" maxLength={500} value={draft.description} placeholder="What do you use this agent for?" onChange={e=>change('description',e.target.value)}/></div>
    <div><label htmlFor="launcher-command">Launch command</label><textarea id="launcher-command" className="mono" required rows={3} maxLength={8000} value={draft.command} placeholder={'Paste the command you normally run, including any agent options'} onChange={e=>change('command',e.target.value)} aria-describedby="launcher-command-help"/><p id="launcher-command-help" className="demo-note mt-2">The exact shell command to start this setup in Claude Code, Codex, or its own CLI. It runs only when you click Launch. Keep passwords and tokens out of saved commands.</p></div>
    <div><label>Working folder</label><div className="launcher-folder-choice"><span>{folder||'Choose the folder this command should start in'}</span><Button disabled={picking} onClick={()=>void pick()}><Icon name="folder" size={13}/>{picking?'Opening…':folder?'Change folder':'Choose folder'}</Button></div><p className="demo-note mt-2">Select the downloaded repository or the project where your agent is installed.</p></div>
    {error&&<p className="run-error" role="alert">{error}</p>}
    <div className="flex justify-end gap-2"><Button disabled={picking} onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={!folder||picking}>{saving?'Saving…':'Save launcher'}</Button></div>
  </fieldset></form>;
}
