import { useEffect, useRef, useState } from 'react';
import { localPreviewUrl, targetKey, type ProjectPreview, type ProjectTarget } from '../../shared/project-tools';
import { Button } from './ui/button';
export function ProjectPreviewPanel({target}:{target?:ProjectTarget}){return <Preview key={target?targetKey(target):'none'} target={target}/>;}
function Preview({target}:{target?:ProjectTarget}){
  const [state,setState]=useState<ProjectPreview|null>(null),[address,setAddress]=useState(''),[command,setCommand]=useState(''),[candidates,setCandidates]=useState<string[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const slot=useRef<HTMLDivElement>(null),key=target?targetKey(target):'';
  useEffect(()=>{
    const bridge=window.theseus,node=slot.current;if(!bridge||!node||!target)return;
    let mounted=true,frame=0;
    const apply=(next:ProjectPreview)=>{if(mounted)setState(next.targetKey===key?next:null);};
    const unsubscribe=bridge.onProjectPreview(apply);
    const update=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const rect=node.getBoundingClientRect(),container=node.closest('.ibody')?.getBoundingClientRect();
      const x=Math.max(0,rect.left),y=Math.max(0,rect.top,container?.top??0),right=Math.min(rect.right,window.innerWidth),bottom=Math.min(rect.bottom,window.innerHeight,container?.bottom??window.innerHeight);
      void bridge.setProjectPreviewBounds(!document.querySelector('[role=dialog], [role=menu]')&&right-x>50&&bottom-y>50?{target,bounds:{x,y,width:right-x,height:bottom-y}}:null).catch(e=>{if(mounted)setError(e.message);});
    });};
    void bridge.getProjectPreview().then(async next=>{if(!mounted)return;if(next.targetKey&&next.targetKey!==key)await bridge.closeProjectPreview();else {apply(next);if(next.url)setAddress(next.url);}update();}).catch(e=>{if(mounted)setError(e.message);});
    const observer=new ResizeObserver(update);observer.observe(node);const mutations=new MutationObserver(update);mutations.observe(document.body,{childList:true,subtree:true});window.addEventListener('resize',update);window.addEventListener('scroll',update,true);
    return()=>{mounted=false;unsubscribe();observer.disconnect();mutations.disconnect();cancelAnimationFrame(frame);window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);void bridge.setProjectPreviewBounds(null).catch(()=>{});};
  },[key]);
  const open=async(url:string)=>{
    if(!window.theseus||!target)return;setBusy(true);setError('');setNotice('');
    try{const value=localPreviewUrl(url);setAddress(value);setState(await window.theseus.openProjectPreview({target,url:value}));}
    catch(e){setError(e instanceof Error?e.message:'Could not open preview.');}finally{setBusy(false);}
  };
  const find=async()=>{
    if(!window.theseus||!target)return;setError('');
    try{const urls=await window.theseus.getPreviewCandidates(target);setCandidates(urls);setNotice(urls.length?'Select a URL printed by this project’s terminal.':'No local URL found in project output. Start a server below or enter its URL.');}
    catch(e){setError(e instanceof Error?e.message:'Could not find URLs.');}
  };
  const start=async()=>{
    if(!window.theseus||!target||!command.trim())return;setBusy(true);setError('');
    try{const shell=await window.theseus.openProjectShell({target,size:{cols:80,rows:24}});await window.theseus.writeProjectShell({id:shell.id,data:command+'\r'});setNotice('Command sent to the project shell. Check Terminal output, then Find URLs or enter the server URL.');}
    catch(e){setError(e instanceof Error?e.message:'Could not start server.');}finally{setBusy(false);}
  };
  const enabled=!!window.theseus&&!!target;
  return <section className="project-preview" aria-label="Running app preview">
    <p className="demo-note">{!window.theseus?'Open the desktop app to preview a running local app.':!target?'Choose a project folder first.':'Preview your running app in an isolated browser.'}</p>
    <form className="project-preview-address" onSubmit={e=>{e.preventDefault();void open(address);}}><input aria-label="Local preview URL" placeholder="http://localhost:5173" value={address} maxLength={4096} onChange={e=>setAddress(e.target.value)} disabled={!enabled}/><Button size="sm" type="submit" disabled={!enabled||!address.trim()||busy}>Open app</Button></form>
    <div className="project-tools-bar"><Button size="sm" disabled={!enabled} onClick={()=>void find()}>Find URLs</Button><Button size="sm" disabled={!enabled||!state?.url||busy} onClick={()=>void open(state!.url)}>Retry / Reload</Button><span role="status">{state?.loading?'Loading app…':state?.error?'Could not load app':state?.title||'No app loaded'}</span></div>
    {!!candidates.length&&<div className="preview-candidates">{candidates.map(url=><button key={url} onClick={()=>void open(url)} disabled={busy}>{url}</button>)}</div>}
    {notice&&<p role="status" className="demo-note">{notice}</p>}
    {(error||state?.error)&&<p role="alert" className="run-error">{error||state?.error}</p>}
    <div className="project-preview-viewport" ref={slot} aria-label="Local app viewport">{!state?.url&&<p className="empty-note">Start your development server and open its local URL.</p>}</div>
    <details className="preview-launch"><summary>Start a development server</summary><form onSubmit={e=>{e.preventDefault();void start();}}><label>Server command<input aria-label="Development server command" placeholder="pnpm dev --host 127.0.0.1" maxLength={15000} value={command} onChange={e=>setCommand(e.target.value)} disabled={!enabled}/></label><Button size="sm" type="submit" disabled={!enabled||!command.trim()||busy}>Run in project shell</Button></form><p className="demo-note">Runs the command you enter with your user permissions. Use a dedicated idle shell. Terminal shows output and provides Ctrl+C. Close shell or Stop all tears down app-launched jobs.</p></details>
    <p className="demo-note">Only the selected local origin can load, including its assets and HMR. External redirects and resources are blocked. An existing server you started elsewhere stays under your control.</p>
  </section>;
}
