import { useMemo, useState } from 'react';
import { useApp } from '@/state/app-context';
import { useMemory } from '@/state/memory-context';
import { SamplePreviewToggle, useSamplePreview } from '@/state/sample-preview';
import { sampleAgents, sampleMemory } from '@/data/sample-preview';
import { Icon } from '../common';
import { Button } from '../ui/button';
import { ProjectLibrary } from './project-library';
type Item={id:string;type:'agents'|'memories'|'runs';title:string;description:string;detail:string;date:string;icon:string;sample:boolean};
export function LibraryPage(){
  const {profiles,m,update,select,profileWarning,historyWarning}=useApp();const {graph,error}=useMemory();const {samples}=useSamplePreview();
  const [filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[selected,setSelected]=useState<string|null>(null);
  const items=useMemo<Item[]>(()=>[
    ...(samples?sampleAgents:profiles.filter(p=>!p.archivedAt)).map(p=>({id:p.id,type:'agents' as const,title:p.name,description:p.description||'Saved Codex configuration',detail:`Codex · ${p.model??'Runtime default'} · ${p.sandbox}\n\n${p.instructions||'No additional instructions.'}`,date:p.updatedAt,icon:p.icon,sample:samples})),
    ...(samples?sampleMemory:graph).records.filter(r=>r.status==='current').map(r=>({id:r.id,type:'memories' as const,title:r.label,description:r.meaning,detail:`${r.kind==='node'?r.nodeType:'Relationship'} · ${r.scope.kind==='personal'?'Personal':r.scope.projectPath}\n\nSource: ${r.source.kind==='manual'?r.source.note:r.source.kind==='run-task'?'User task from run':'User task draft'}\n\n${r.meaning}`,date:r.updatedAt,icon:r.kind==='relationship'?'link':'brain',sample:samples})),
    ...Object.values(m.runs).map(r=>({id:r.id,type:'runs' as const,title:r.task,description:`${r.projectName} · ${r.status}`,detail:`${r.projectPath}${r.executionPath?`\nWorktree: ${r.executionPath}`:''}\n${r.status} · ${r.output.length} output entries${r.error?`\n\n${r.error}`:''}`,date:r.endedAt??r.startedAt,icon:'term',sample:false})),
  ].sort((a,b)=>b.date.localeCompare(a.date)),[profiles,m.runs,graph,samples]);
  const visible=items.filter(i=>(filter==='all'||i.type===filter)&&`${i.title} ${i.description}`.toLowerCase().includes(search.trim().toLowerCase()));
  const item=visible.find(i=>i.id===selected);
  const open=(item:Item)=>{if(item.type==='runs'){select(item.id);update(d=>{d.layout='focus';d.showInspector=true;});}else update(d=>{d.page=item.type==='agents'?'crew':'memory';});};
  return <div className="page resource-page"><div className="page-w"><div className="resource-heading"><div><h1><Icon name="file" size={21}/>Library</h1><p>Saved records and explicitly imported project files, searchable in one place.</p></div><Button onClick={()=>update(d=>{d.page='history';})}><Icon name="clock" size={13}/>Run history</Button></div>
    <SamplePreviewToggle/>{(profileWarning||historyWarning||graph.warning||error)&&<p role="alert" className="run-error">{[profileWarning,historyWarning,graph.warning,error].filter(Boolean).join(' ')}</p>}
    <div className="resource-toolbar"><label className="search"><Icon name="search" size={14}/><input aria-label="Search library" placeholder="Search your library…" value={search} onChange={e=>{setSearch(e.target.value);setSelected(null);}}/></label><span>{filter==='files'?'Filename and content search':`${visible.length} saved records`}</span></div>
    <div className="resource-filters" aria-label="Library filters">{[['all','All items'],['agents','Agents'],['memories','Memories'],['runs','Runs'],['files','Project files']].map(([value,label])=><button key={value} aria-pressed={filter===value} className={filter===value?'on':''} onClick={()=>{setFilter(value);setSelected(null);}}>{label}{value!=='files'&&value!=='all'&&<small>{items.filter(i=>value==='all'||i.type===value).length}</small>}</button>)}</div>
    {(filter==='all'||filter==='files')&&<ProjectLibrary bridge={window.theseus} search={search} samples={samples}/>}
    {filter!=='files'&&<div className={`library-workspace ${item?'has-detail':''}`}><div className="library-list">{visible.length?visible.map(i=><button data-library-id={i.id} key={i.id} className={`library-row ${item?.id===i.id?'on':''}`} onClick={()=>setSelected(i.id)}><span className="resource-icon"><Icon name={i.icon} size={18}/></span><span><b>{i.title}</b><small>{i.description}</small></span><span className="library-meta"><small>{i.sample?'Sample · ':''}{i.type==='agents'?'Agent':i.type==='memories'?'Memory':'Run'}</small><time>{new Date(i.date).toLocaleDateString()}</time></span><Icon name="right" size={13}/></button>):<div className="resource-empty"><Icon name="file" size={30}/><h2>{items.length?'No matching items':'Your library starts here'}</h2><p>{items.length?'Try another search or category.':'Create an agent, save a memory, or run a task to see it here. Files are not imported automatically.'}</p><Button onClick={()=>update(d=>{d.page='crew';})}>Go to agents</Button></div>}</div>
      {item&&<aside className="library-detail" aria-label="Library item details"><div className="flex justify-between gap-2"><span className="demo-note">{item.sample?'Sample preview':item.type==='runs'?'Saved run':'Saved locally'}</span><button className="ib" aria-label="Close library details" onClick={()=>setSelected(null)}><Icon name="x"/></button></div><h2>{item.title}</h2><p>{item.detail}</p><small>Updated {new Date(item.date).toLocaleString()}</small><Button onClick={()=>open(item)}>{item.type==='runs'?'Inspect run':item.type==='agents'?'Open agents':'Open Memory'}<Icon name="right" size={12}/></Button></aside>}
    </div>}<p className="demo-note mt-5">Saved records reference their original source. Project file imports stay scoped to the selected project and never automatically become agent context.</p>
  </div></div>;
}
