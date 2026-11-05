import { useRef, useState } from 'react';
import type { GitHubAgentCatalog, GitHubAgentPreview } from '../../../shared/github-agents';
import { useApp } from '@/state/app-context';
import { Button } from '../ui/button';
import { Icon } from '../common';

const message=(error:unknown)=>error instanceof Error?error.message:'Could not load this agent. Try again.';

export function GitHubAgentImport({onClose,onAdded}:{onClose:()=>void;onAdded:(name:string)=>void}){
  const {saveProfile}=useApp();
  const [repository,setRepository]=useState(''),[ref,setRef]=useState('');
  const [catalog,setCatalog]=useState<GitHubAgentCatalog|null>(null),[preview,setPreview]=useState<GitHubAgentPreview|null>(null);
  const [selected,setSelected]=useState(''),[search,setSearch]=useState('');
  const [name,setName]=useState(''),[description,setDescription]=useState(''),[sandbox,setSandbox]=useState<'read-only'|'workspace-write'>('read-only');
  const [loading,setLoading]=useState(false),[reading,setReading]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const generation=useRef(0),previewHeading=useRef<HTMLHeadingElement>(null);
  const discover=async(event:React.FormEvent)=>{
    event.preventDefault();if(!window.theseus)return;
    const current=++generation.current;
    setLoading(true);setError('');setCatalog(null);setPreview(null);setSelected('');setSearch('');
    try{const result=await window.theseus.discoverGitHubAgents({repository,ref});if(current===generation.current)setCatalog(result);}
    catch(error){if(current===generation.current)setError(message(error));}
    finally{if(current===generation.current)setLoading(false);}
  };
  const choose=async(path:string)=>{
    if(!window.theseus||!catalog)return;
    const current=++generation.current;
    setSelected(path);setReading(true);setPreview(null);setError('');
    try{
      const result=await window.theseus.previewGitHubAgent({catalogId:catalog.id,path});
      if(current===generation.current){setPreview(result);setName(result.name);setDescription(result.description);setSandbox('read-only');requestAnimationFrame(()=>previewHeading.current?.focus());}
    }catch(error){if(current===generation.current)setError(message(error));}
    finally{if(current===generation.current)setReading(false);}
  };
  const add=async(event:React.FormEvent)=>{
    event.preventDefault();if(!preview||saving)return;
    setSaving(true);setError('');
    try{
      const profile=await saveProfile({name:name.trim(),description,icon:'book',color:'violet',runtime:'codex',model:null,reasoningEffort:null,instructions:preview.instructions,githubSource:preview.source,memory:'none',sandbox,timeoutSeconds:1800,folderChoice:null});
      onAdded(profile.name);
    }catch(error){setError(message(error));setSaving(false);}
  };
  const files=catalog?.files.filter(file=>file.path.toLowerCase().includes(search.trim().toLowerCase()))??[];
  return <section className="github-import" aria-labelledby="github-import-title">
    <div className="github-import-heading"><div><h2 id="github-import-title"><Icon name="branch" size={19}/>Add an agent from GitHub</h2><p>Bring an agent’s instructions into Theseus, then give it a task in chat.</p></div><Button disabled={saving} onClick={()=>{generation.current++;onClose();}}>Cancel import</Button></div>
    <ol className="github-import-steps" aria-label="Import progress"><li aria-current={!catalog?'step':undefined}><span>1</span>Find a repository</li><li aria-current={catalog&&!preview?'step':undefined}><span>2</span>Choose instructions</li><li aria-current={preview?'step':undefined}><span>3</span>Review & add</li></ol>
    <form className="github-repository-form agent-fields" onSubmit={event=>void discover(event)}>
      <div><label htmlFor="github-repository">GitHub repository</label><input id="github-repository" autoFocus required maxLength={500} placeholder="https://github.com/owner/repo" value={repository} disabled={loading||reading||saving} onChange={event=>{setRepository(event.target.value);setCatalog(null);setPreview(null);setError('');}} aria-describedby="github-repository-help"/></div>
      <div><label htmlFor="github-ref">Branch or tag <span className="muted">· optional</span></label><input id="github-ref" maxLength={200} placeholder="Default branch" value={ref} disabled={loading||reading||saving} onChange={event=>{setRef(event.target.value);setCatalog(null);setPreview(null);setError('');}}/></div>
      <Button type="submit" variant="primary" disabled={!window.theseus||loading||reading||saving||!repository.trim()}><Icon name={loading?'clock':'search'} size={14}/>{loading?'Finding agents…':'Find agents'}</Button>
    </form>
    <p id="github-repository-help" className="github-import-help">Public repositories only. You can also enter owner/repository. No GitHub login needed.</p>
    {!window.theseus&&<p className="demo-note">Open the desktop app to import and save GitHub agents.</p>}
    <div role="status" aria-live="polite">{loading&&<p className="github-import-feedback">Finding Markdown instructions on GitHub…</p>}{reading&&<p className="github-import-feedback">Loading {selected}…</p>}</div>
    {error&&<p className="run-error github-import-feedback" role="alert">{error}</p>}
    {catalog&&<>
      <div className="github-catalog-heading"><h3>{catalog.repository.replace('https://github.com/','')}</h3><span>{catalog.ref} · {catalog.commit.slice(0,7)}</span></div>
      {catalog.omitted>0&&<p className="demo-note">Showing the first 1,000 Markdown files. {catalog.omitted} additional files are omitted; try a smaller repository if your agent isn’t listed.</p>}
      {!catalog.files.length?<div className="resource-empty"><Icon name="file" size={28}/><h3>No Markdown instructions found</h3><p>Try a repository with agent definitions, AGENTS.md, or SKILL.md files. Standalone tools need an instruction file to work with this importer.</p></div>:<div className="github-import-workspace">
        <section className="github-files" aria-label="Repository files"><label htmlFor="github-file-search">Choose an instruction file</label><div className="github-file-search"><Icon name="search" size={13}/><input id="github-file-search" placeholder="Filter by name or folder…" value={search} disabled={saving} onChange={event=>setSearch(event.target.value)}/></div><p className="github-import-help">{files.length} {files.length===1?'Markdown file':'Markdown files'} · select one to preview</p>
          <div className="github-file-list">{files.map(file=><button key={file.path} type="button" aria-pressed={selected===file.path} disabled={saving||file.size>128000} onClick={()=>void choose(file.path)}><Icon name="file" size={15}/><span>{file.path}<small>{file.size>128000?'Too large to import':`${Math.max(1,Math.ceil(file.size/1024))} KB`}</small></span>{selected===file.path&&<Icon name="check" size={14}/>}</button>)}{!files.length&&<p className="github-import-help">No files match “{search}”. Try a different filename.</p>}</div>
        </section>
        <section className="github-agent-preview" aria-label="Agent preview">
          {preview?<form className="agent-fields" onSubmit={event=>void add(event)}>
            <h3 ref={previewHeading} tabIndex={-1}>Review your agent</h3><p className="github-import-help github-source-path">{preview.source.path}</p>
            <fieldset disabled={saving}>
              <div><label htmlFor="github-agent-name">Agent name</label><input id="github-agent-name" required maxLength={80} value={name} onChange={event=>setName(event.target.value)}/></div>
              <div><label htmlFor="github-agent-description">Description <span className="muted">· optional</span></label><input id="github-agent-description" maxLength={500} placeholder="What does this agent help with?" value={description} onChange={event=>setDescription(event.target.value)}/></div>
              <div><label htmlFor="github-agent-instructions">Instructions to import</label><textarea id="github-agent-instructions" rows={10} readOnly value={preview.instructions}/><p className="github-import-help">{preview.instructions.length.toLocaleString()} / 32,000 characters{preview.hadFrontmatter?' · provider metadata removed':''}. Review the instructions before adding.</p></div>
              <div className="github-import-compatibility"><Icon name="code" size={16}/><p><b>Runs with Codex in Theseus</b>This imports the selected file’s instructions. Models, tools, scripts, linked files, and provider settings are not installed. Instructions that depend on another tool may need editing after import.</p></div>
              <div><label htmlFor="github-agent-permissions">Project access</label><select id="github-agent-permissions" value={sandbox} onChange={event=>setSandbox(event.target.value as typeof sandbox)}><option value="read-only">Read only · review and research</option><option value="workspace-write">Allow edits · work on your project</option></select></div>
              <div className="github-import-footer"><p>Saved locally. Choose a project when you start a task.</p><Button type="submit" variant="primary" disabled={!name.trim()||saving}><Icon name="plus" size={14}/>{saving?'Adding agent…':'Add agent'}</Button></div>
            </fieldset>
          </form>:<div className="github-preview-empty"><Icon name="book" size={30}/><h3>{reading?'Loading instructions…':'Choose the agent you need'}</h3><p>Preview a file, check what it does, and choose its project access before adding it.</p></div>}
        </section>
      </div>}
    </>}
  </section>;
}
