import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/state/app-context';
import type { LibraryState } from '../../../shared/library';
import { taskInvocations as catalog, type TaskFileReview } from '../../../shared/task-context';
import { Button } from '../ui/button';
import { Icon } from '../common';
import './task-context.css';

export function TaskContextComposer({draft,setDraft,disabled,onBusy}:{draft:string;setDraft:(text:string)=>void;disabled:boolean;onBusy:(busy:boolean)=>void}){
  const {workspace,profiles,selectedProfile,useProfile,crewRoute,taskAttachments,setTaskAttachments,taskInvocations,setTaskInvocations}=useApp();
  const [panel,setPanel]=useState<'files'|'agents'|'commands'|null>(null),[search,setSearch]=useState(''),[state,setState]=useState<LibraryState|null>(null),[preview,setPreview]=useState<TaskFileReview|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const generation=useRef(0),latestWorkspace=useRef(workspace?.id);latestWorkspace.current=workspace?.id;
  const changeBusy=(value:boolean)=>{setBusy(value);onBusy(value);};
  useEffect(()=>()=>{++generation.current;onBusy(false);},[]);
  useEffect(()=>{++generation.current;setState(null);setPreview(null);setError('');setPanel(null);changeBusy(false);},[workspace?.id]);
  useEffect(()=>{
    const match=draft.match(/(?:^|\s)([@/$])([\w.-]*)$/);if(!match)return;
    setPanel(match[1]==='@'?'agents':'commands');setSearch(match[2]);
  },[draft]);
  const load=async(importing=false,query=search)=>{
    if(!window.theseus||!workspace)return;
    const token=++generation.current,workspaceId=workspace.id;changeBusy(true);setError('');setPreview(null);
    try{const result=importing?await window.theseus.importLibrary({workspaceId,kind:'files',search:query}):await window.theseus.getLibrary({workspaceId,search:query});if(token===generation.current&&latestWorkspace.current===workspaceId&&result)setState(result);}
    catch(reason){if(token===generation.current)setError(reason instanceof Error?reason.message:'Could not read files. Try again.');}
    finally{if(token===generation.current)changeBusy(false);}
  };
  const inspect=async(fileId:string)=>{
    if(!window.theseus||!workspace)return;
    const token=++generation.current,workspaceId=workspace.id;changeBusy(true);setError('');setPreview(null);
    try{const result=await window.theseus.reviewTaskFile({workspaceId,fileId});if(token===generation.current&&latestWorkspace.current===workspaceId)setPreview(result);}
    catch(reason){if(token===generation.current)setError(reason instanceof Error?reason.message:'Could not review file. Try again.');}
    finally{if(token===generation.current)changeBusy(false);}
  };
  const stripTrigger=()=>setDraft(draft.replace(/(?:^|\s)[@/$][\w.-]*$/,''));
  const openFiles=()=>{setPanel('files');setSearch('');void load(false,'');};
  const selectedCount=taskAttachments.filter(item=>item.included).length;
  return <section className="task-context" aria-label="Task context">
    <div className="task-context-actions"><Button size="sm" disabled={disabled||busy||!workspace||!window.theseus} onClick={()=>{setPanel('files');setSearch('');void load(true,'');}}><Icon name="plus" size={12}/>Attach files</Button><Button size="sm" disabled={disabled||busy} onClick={()=>{setPanel('agents');setSearch('');}}>Mention agent or file</Button><Button size="sm" disabled={disabled||busy} onClick={()=>{setPanel('commands');setSearch('');}}>Commands & skills</Button><span>{selectedCount} file(s) included</span></div>
    <p className="task-context-help">Select and review context before starting. Typed @mentions, /commands and $skills are plain task text until you choose an action below.</p>
    {taskAttachments.map(({review,included})=><div className="task-context-file" key={review.token}><label><input type="checkbox" checked={included} disabled={disabled||busy||!included&&selectedCount>=5} onChange={e=>setTaskAttachments(items=>items.map(item=>item.review.token===review.token?{...item,included:e.target.checked}:item))}/><span>Include {review.path}</span></label><Button size="sm" disabled={disabled||busy} onClick={()=>{setPanel('files');void inspect(review.fileId);}}>Review again</Button><Button size="sm" disabled={disabled||busy} aria-label={`Remove attachment ${review.path}`} onClick={()=>setTaskAttachments(items=>items.filter(item=>item.review.token!==review.token))}>Remove</Button></div>)}
    {taskInvocations.map(id=>{const item=catalog.find(item=>item.id===id)!;return <div className="task-context-file" key={id}><span><b>{item.token}</b> · {item.label} · {item.kind==='skill'?'built-in skill workflow':'prompt command'}</span><Button size="sm" disabled={disabled||busy} aria-label={`Remove ${item.token}`} onClick={()=>setTaskInvocations(ids=>ids.filter(value=>value!==id))}>Remove</Button></div>;})}
    {panel&&<div className="task-context-panel"><div className="task-context-actions"><b>{panel==='files'?'Review project files':panel==='agents'?'Resolve a mention':'Supported commands & skills'}</b><span className="task-context-spacer"/><Button size="sm" disabled={busy} onClick={()=>{setPanel(null);setPreview(null);}}>Close context chooser</Button></div>
      {panel==='agents'&&<><p>Choose a saved agent to run this task, or include a reviewed project file. This does not contact another agent.</p><div className="task-context-actions"><Button size="sm" disabled={disabled||busy||!workspace||!window.theseus} onClick={openFiles}>Mention a project file</Button><label>Find agent<input aria-label="Find agent" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>{crewRoute!=='single'?<p>Switch task routing to Single agent to select a saved agent.</p>:<><p>Selected agent: {selectedProfile?.name??'Codex defaults'}</p>{profiles.filter(profile=>!profile.archivedAt&&profile.name.toLowerCase().includes(search.toLowerCase())).map(profile=><Button key={profile.id} size="sm" disabled={disabled||busy} onClick={()=>{changeBusy(true);setError('');void useProfile(profile.id).then(()=>{stripTrigger();setPanel(null);}).catch(reason=>setError(reason instanceof Error?reason.message:'Could not select agent.')).finally(()=>changeBusy(false));}}>Use @{profile.name}</Button>)}{!profiles.some(profile=>!profile.archivedAt)&&<p>No saved agents. Create one in Agents, or use Codex defaults.</p>}</>}</>}
      {panel==='commands'&&<><p>These built-in workflows add the shown instructions to the next live task. They do not run shell commands or load installed Codex skills.</p>{catalog.filter(item=>`${item.token} ${item.label}`.toLowerCase().includes(search.toLowerCase())).map(item=><div className="task-context-option" key={item.id}><div><b>{item.token} · {item.label}</b><p>{item.description}</p><small>{item.kind==='skill'?'Built-in skill workflow':'Prompt command'}</small></div><Button size="sm" disabled={disabled||busy} onClick={()=>{setTaskInvocations(ids=>[...ids.filter(id=>catalog.find(value=>value.id===id)?.kind!==item.kind),item.id]);stripTrigger();setPanel(null);}}>Use {item.token}</Button></div>)}</>}
      {panel==='files'&&<><p>Importing keeps files in the project Library. Only checked files are included in this task · up to 5 files, 32,000 characters each / 64,000 total. No truncation.</p><div className="task-context-actions"><label>Search indexed files<input aria-label="Find task file" maxLength={500} value={search} disabled={busy} onChange={e=>setSearch(e.target.value)}/></label><Button size="sm" disabled={disabled||busy} onClick={()=>void load()}>Search files</Button><Button size="sm" disabled={disabled||busy} onClick={()=>void load(true)}>Select project files</Button></div>{state?.warning&&<p role="alert">{state.warning}</p>}{state&&<p>{state.matchingFiles} entries{state.matchingFiles>state.files.length?' · narrow your search to see more':''}</p>}<div className="task-context-results">{state?.files.map(file=><button key={file.id} disabled={disabled||busy||file.status!=='indexed'} onClick={()=>void inspect(file.id)}><span>{file.path}</span><small>{file.status}</small></button>)}{state&&!state.files.length&&<p>No indexed files found. Select project files or search again.</p>}</div>{preview&&<div className="task-context-preview"><b>{preview.path}</b><pre tabIndex={0} aria-label="Task file content">{preview.content||'(Empty file)'}</pre><Button size="sm" disabled={disabled||busy||selectedCount>=5&&!taskAttachments.some(item=>item.review.fileId===preview.fileId&&item.included)} onClick={()=>{setTaskAttachments(items=>[...items.filter(item=>item.review.fileId!==preview.fileId),{review:preview,included:true}]);stripTrigger();setPreview(null);}}>Include reviewed file in task</Button></div>}</>}
    </div>}
    {busy&&<p role="status">Reading selection…</p>}{error&&<p className="run-error" role="alert">{error}</p>}
  </section>;
}
