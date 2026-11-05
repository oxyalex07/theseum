import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { targetKey, type ProjectShell, type ProjectTarget } from '../../shared/project-tools';
import { Button } from './ui/button';
export default function Shell({target}:{target?:ProjectTarget}){
  const [shell,setShell]=useState<ProjectShell|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(!!window.theseus&&!!target),[error,setError]=useState('');
  const slot=useRef<HTMLDivElement>(null),terminal=useRef<Terminal|null>(null),fit=useRef<FitAddon|null>(null),current=useRef<ProjectShell|null>(null),cursor=useRef({id:'',end:0});
  const key=target?targetKey(target):'';
  current.current=shell;
  useEffect(()=>{
    const node=slot.current,bridge=window.theseus;if(!node||!bridge||!target)return;
    const term=new Terminal({fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace',fontSize:12,cursorBlink:true,scrollback:3000,theme:{background:'#0b0b11',foreground:'#ececf3'},allowProposedApi:false});
    const addon=new FitAddon();terminal.current=term;fit.current=addon;term.loadAddon(addon);term.open(node);
    let frame=0,disposed=false,queue=Promise.resolve();
    const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!disposed&&node.clientWidth>0&&node.clientHeight>0)addon.fit();});};
    const observer=new ResizeObserver(resize);observer.observe(node);resize();
    const resized=term.onResize(size=>{const c=current.current;if(c?.status==='running')void bridge.resizeProjectShell({id:c.id,size:{cols:Math.min(500,size.cols),rows:Math.min(200,size.rows)}}).catch(e=>{if(!disposed)setError(e.message);});});
    const input=term.onData(data=>{const id=current.current?.status==='running'?current.current.id:null;if(!id)return;queue=queue.then(async()=>{for(let i=0;i<data.length;i+=16000)await bridge.writeProjectShell({id,data:data.slice(i,i+16000)});}).catch(e=>{if(!disposed)setError(e.message);});});
    return()=>{disposed=true;observer.disconnect();cancelAnimationFrame(frame);input.dispose();resized.dispose();term.dispose();terminal.current=null;fit.current=null;};
  },[key]);
  useEffect(()=>{
    const bridge=window.theseus;if(!bridge||!target)return;
    let live=true;
    const apply=(next:ProjectShell|null)=>{if(live&&next?.targetKey===key)setShell(old=>old&&old.id===next.id&&old.revision>next.revision?old:next);};
    const unsubscribe=bridge.onProjectShell(apply);
    void bridge.getProjectShell(target).then(apply).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});
    return()=>{live=false;unsubscribe();};
  },[key]);
  useEffect(()=>{
    const term=terminal.current;if(!shell||!term)return;
    const end=shell.outputStart+shell.output.length;
    if(cursor.current.id!==shell.id||cursor.current.end<shell.outputStart){term.reset();cursor.current={id:shell.id,end:shell.outputStart};}
    if(end>cursor.current.end)term.write(shell.output.slice(cursor.current.end-shell.outputStart));
    cursor.current.end=end;
  },[shell]);
  useEffect(()=>{
    const term=terminal.current,bridge=window.theseus;
    if(!term||!bridge||shell?.status!=='running')return;
    fit.current?.fit();
    const size={cols:Math.min(500,term.cols),rows:Math.min(200,term.rows)};
    if(shell.cols!==size.cols||shell.rows!==size.rows)void bridge.resizeProjectShell({id:shell.id,size}).catch(e=>setError(e.message));
  },[shell?.id,shell?.status]);
  const open=async()=>{
    if(!window.theseus||!target)return;setBusy(true);setError('');
    try{fit.current?.fit();const term=terminal.current;setShell(await window.theseus.openProjectShell({target,size:{cols:Math.min(500,term?.cols??80),rows:Math.min(200,term?.rows??24)}}));terminal.current?.focus();}
    catch(e){setError(e instanceof Error?e.message:'Could not open shell.');}finally{setBusy(false);}
  };
  const close=async()=>{if(!shell||!window.theseus)return;setBusy(true);setError('');try{await window.theseus.closeProjectShell(shell.id);}catch(e){setError(e instanceof Error?e.message:'Could not close shell.');}finally{setBusy(false);}};
  return <section className="project-shell" aria-label="Interactive project terminal">
    <div className="project-tools-bar"><b>Interactive shell</b><span role="status">{loading?'Connecting…':shell?.status??'Not started'}</span>{shell?.status==='running'||shell?.status==='stopping'?<Button size="sm" variant="destructive" disabled={busy||shell.status==='stopping'&&!shell.error} onClick={()=>void close()}>{shell.status==='running'?'Close shell':shell.error?'Retry close':'Stopping…'}</Button>:<Button size="sm" disabled={!window.theseus||!target||busy||loading} onClick={()=>void open()}>{busy?'Opening…':shell?'New shell':'Open shell'}</Button>}</div>
    <p className="demo-note">{shell?.projectPath??(!target?'Choose a project folder first.':'Shell starts in this project’s execution folder.')} {shell?.exitCode!==undefined?`Exit ${shell.exitCode}.`:''}</p>
    {!window.theseus&&<p className="empty-note">Open the desktop app to use your project shell.</p>}
    <div ref={slot} className="project-shell-screen" aria-label="Interactive terminal screen" onClick={()=>terminal.current?.focus()}/>
    {shell?.outputStart? <small className="demo-note">Earlier output trimmed; reconnect restores the last 120,000 characters.</small>:null}
    {(error||shell?.error)&&<p role="alert" className="run-error">{error||shell?.error}</p>}
    <p className="demo-note">Type directly in the shell. Ctrl+C interrupts a job; <code>exit</code> ends the shell. Commands use your user permissions. The shell stays open between tabs; Close shell, Stop all, or app exit stops its jobs. Codex events appear in the conversation.</p>
  </section>;
}
