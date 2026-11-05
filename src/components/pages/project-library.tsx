import { useEffect, useRef, useState } from 'react';
import type { LibraryBridge, LibraryPreview, LibraryState } from '../../../shared/library';
import { useApp } from '@/state/app-context';
import { Icon } from '../common';
import { Button } from '../ui/button';
import './project-library.css';

const statusLabel={indexed:'Indexed',removed:'Removed',inaccessible:'Inaccessible',unsupported:'Unsupported','too-large':'Too large',limit:'Index limit'};
export function ProjectLibrary({bridge,search,samples}:{bridge?:LibraryBridge;search:string;samples:boolean}) {
  const {workspace,chooseWorkspace}=useApp();
  const [savedState,setState]=useState<LibraryState|null>(null),[savedPreview,setPreview]=useState<LibraryPreview|null>(null);
  const state=savedState?.projectPath===workspace?.path?savedState:null;
  const preview=savedPreview?.projectPath===workspace?.path?savedPreview:null;
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmClear,setConfirmClear]=useState(false);
  const [inspecting,setInspecting]=useState(false);
  const inspectionPanel=useRef<HTMLElement>(null);
  const generation=useRef(0),inspection=useRef(0);
  useEffect(()=>{if(preview)inspectionPanel.current?.scrollIntoView({block:'nearest'});},[preview?.file.id]);
  useEffect(()=>{
    const token=++generation.current;++inspection.current;setPreview(null);setInspecting(false);setConfirmClear(false);setError('');
    if(!bridge||!workspace||samples){setState(null);setBusy(false);return;}
    setBusy(true);setState(previous=>previous?.projectPath===workspace.path?previous:null);
    const timer=setTimeout(()=>{void bridge.getLibrary({workspaceId:workspace.id,search}).then(value=>{if(token===generation.current)setState(value);}).catch(reason=>{if(token===generation.current){setState(null);setError(reason instanceof Error?reason.message:'Could not read the project index. Refresh to try again.');}}).finally(()=>{if(token===generation.current)setBusy(false);});},200);
    return()=>{clearTimeout(timer);++generation.current;++inspection.current;};
  },[bridge,workspace?.id,search,samples]);
  const act=async(kind:'files'|'folder'|'refresh'|'clear'|'remove',sourceId?:string)=>{
    if(!bridge||!workspace)return;
    const token=++generation.current;++inspection.current;setPreview(null);setInspecting(false);setBusy(true);setError('');setConfirmClear(false);
    const request={workspaceId:workspace.id,search};
    try{
      const result=kind==='files'||kind==='folder'?await bridge.importLibrary({...request,kind}):kind==='clear'?await bridge.clearLibrary(request):kind==='remove'?await bridge.removeLibrarySource({...request,sourceId:sourceId!}):await bridge.getLibrary(request);
      if(token===generation.current&&result)setState(result);
    }catch(reason){if(token===generation.current)setError(reason instanceof Error?reason.message:'Could not update the project index. Try again.');}
    finally{if(token===generation.current)setBusy(false);}
  };
  const inspect=async(fileId:string)=>{
    if(!bridge||!workspace)return;
    const token=++inspection.current;setPreview(null);setInspecting(true);setError('');
    try{const result=await bridge.inspectLibraryFile({workspaceId:workspace.id,fileId});if(token===inspection.current)setPreview(result);}
    catch(reason){if(token===inspection.current)setError(reason instanceof Error?reason.message:'Could not inspect this file. Refresh and try again.');}
    finally{if(token===inspection.current)setInspecting(false);}
  };
  return <section className="project-library" aria-labelledby="project-library-title" aria-busy={busy}>
    <div className="project-library-heading"><div><h2 id="project-library-title"><Icon name="folder" size={17}/>Project files</h2><p>{samples?'Project file imports are available in saved data mode.':!bridge?'File importing requires the Electron desktop app.':workspace?'Only files you explicitly import from this project are indexed.':'Choose a project, then explicitly import files or folders within it.'}</p></div>{!samples&&bridge&&<Button disabled={busy} onClick={()=>void chooseWorkspace()}>{workspace?'Change project':'Choose project folder'}</Button>}</div>
    {!samples&&bridge&&workspace&&<>
      <div className="project-library-scope"><strong>{workspace.name}</strong><code>{workspace.path}</code></div>
      <div className="project-library-actions"><Button disabled={busy} onClick={()=>void act('files')}><Icon name="plus" size={13}/>Import files</Button><Button disabled={busy} onClick={()=>void act('folder')}><Icon name="folder" size={13}/>Import folder</Button><Button disabled={busy||!state?.sources.length} onClick={()=>void act('refresh')}><Icon name="ref" size={13}/>Refresh index</Button>{!!state?.sources.length&&<Button disabled={busy} onClick={()=>setConfirmClear(true)}>Clear project index</Button>}</div>
      <p className="project-library-help">UTF-8 text and source files · 256 KiB per file · 1,000 files / 8 MiB per project. Hidden files, dependencies, build folders and symlinks are excluded. Search and Refresh reread imports; no background watcher runs.</p>
      {confirmClear&&<div className="project-library-confirm" role="group" aria-label="Clear project index confirmation"><p>Remove every Library import for <b>{workspace.name}</b>? Original files stay on disk.</p><Button onClick={()=>void act('clear')}>Remove all project imports</Button><Button onClick={()=>setConfirmClear(false)}>Cancel</Button></div>}
      {state?.sources.length?<details className="project-library-sources"><summary>Manage imports ({state.sources.length})</summary><ul>{state.sources.map(source=><li key={source.id}><span><Icon name={source.kind==='folder'?'folder':'file'} size={13}/><code>{source.path==='.'?'Entire selected project':source.path}</code><small>{source.kind}</small></span><Button disabled={busy} aria-label={`Remove import ${source.path}`} onClick={()=>void act('remove',source.id)}>Remove import</Button></li>)}</ul><p>Removing an import removes its index entries. Files still covered by another import remain indexed.</p></details>:null}
      {busy&&<p role="status">Reading project imports…</p>}
      {inspecting&&<p role="status">Reading selected file…</p>}
      {state?.warning&&<p role="alert" className="run-error">{state.warning}</p>}
      {state&&!busy&&<p className="project-library-count" role="status">{state.indexedFiles} indexed · {state.totalFiles-state.indexedFiles} unavailable or skipped · {state.matchingFiles} {search.trim()?'matching':'total'} entries{state.matchingFiles>state.files.length?` · Showing first ${state.files.length}; narrow your search`:''}</p>}
      {state&&<div className={`project-file-workspace ${preview?'has-preview':''}`}><div className="project-file-results" aria-label="Indexed project files">{state.files.map(file=><button key={file.id} data-project-file={file.path} className={`project-file-row ${preview?.file.id===file.id?'on':''}`} disabled={busy} onClick={()=>void inspect(file.id)}><Icon name={file.status==='indexed'?'file':'alert'} size={15}/><span><b>{file.path}</b>{file.snippet&&<small>Line {file.line}: {file.snippet}</small>}{file.message&&<small>{file.message}</small>}</span><small className={file.status==='indexed'?'':'project-file-unavailable'}>{statusLabel[file.status]}</small></button>)}{!state.files.length&&!busy&&<div className="project-file-empty"><h3>{state.sources.length?'No matching project files':'No project files imported'}</h3><p>{state.sources.length?'Try a filename or phrase from a supported file, or import another folder.':'Use Import files or Import folder to choose what belongs in this project’s Library.'}</p></div>}</div>
        {preview&&<aside ref={inspectionPanel} className="project-file-preview" aria-label="Project file inspection"><div className="project-file-preview-heading"><h3>{preview.file.path}</h3><button className="ib" aria-label="Close file inspection" onClick={()=>{++inspection.current;setPreview(null);}}><Icon name="x"/></button></div><p>{statusLabel[preview.file.status]}{preview.file.size!==undefined?` · ${preview.file.size.toLocaleString()} bytes`:''}{preview.file.modifiedAt?` · Modified ${new Date(preview.file.modifiedAt).toLocaleString()}`:''}</p>{preview.content!==null?<pre tabIndex={0} aria-label="Indexed file content">{preview.content||'(Empty file)'}</pre>:<p role="status">{preview.file.message}</p>}<small>Read from this project on inspection. File text is displayed as plain text.</small></aside>}
      </div>}
    </>}
    {error&&<p role="alert" className="run-error">{error}</p>}
    <p className="project-library-privacy"><Icon name="shield" size={13}/>Local index only. Imported file content is never automatically attached to agent tasks. This Library has no file-to-agent context action.</p>
  </section>;
}
