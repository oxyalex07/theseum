import { useEffect, useRef, useState } from 'react';
import { terminalActive, type TerminalCommand } from '../../../shared/terminal';
import { useApp } from '@/state/app-context';
import { Icon } from '../common';
import { Button } from '../ui/button';
import { ProjectTerminal } from '../project-terminal';
export function TerminalPage(){
  const [interactive,setInteractive]=useState(false);const {workspace,chooseWorkspace}=useApp();const [error,setError]=useState('');
  if(!interactive)return <CommandTerminalPage onInteractive={()=>setInteractive(true)}/>;
  return <div className="terminal-page interactive-terminal-page"><header className="terminal-heading"><div><h1><Icon name="term" size={21}/>Terminal</h1><p>Interactive project shell</p></div><div className="flex gap-2"><Button onClick={()=>setInteractive(false)}>Command history</Button><Button disabled={!window.theseus} onClick={()=>void chooseWorkspace().catch(e=>setError(e.message))}>{workspace?'Change project':'Choose project folder'}</Button></div></header>{error&&<p role="alert" className="run-error">{error}</p>}<ProjectTerminal target={workspace?{workspaceId:workspace.id}:undefined}/></div>;
}
function CommandTerminalPage({onInteractive}:{onInteractive:()=>void}){
  const {m,update,workspace,chooseWorkspace}=useApp();
  const [commands,setCommands]=useState<TerminalCommand[]>([]),[shell,setShell]=useState(''),[loading,setLoading]=useState(!!window.theseus),[starting,setStarting]=useState(false),[error,setError]=useState('');
  const output=useRef<HTMLDivElement>(null),follow=useRef(true);
  const draft=m.drafts.terminal??'';
  const active=commands.find(c=>terminalActive(c.status));
  const apply=(next:TerminalCommand)=>setCommands(prev=>{
    const previous=prev.find(c=>c.id===next.id);if(previous&&previous.revision>next.revision)return prev;
    return [...prev.filter(c=>c.id!==next.id),next].sort((a,b)=>a.startedAt.localeCompare(b.startedAt)).slice(-20);
  });
  useEffect(()=>{
    if(!window.theseus)return;
    let mounted=true;
    const unsubscribe=window.theseus.onTerminalCommand(next=>{if(mounted)apply(next);});
    window.theseus.getTerminalState().then(state=>{if(mounted){setShell(state.shell);state.commands.forEach(apply);setLoading(false);}}).catch(e=>{if(mounted){setError(e instanceof Error?e.message:'Could not connect to the terminal.');setLoading(false);}});
    return()=>{mounted=false;unsubscribe();};
  },[]);
  useEffect(()=>{if(follow.current&&output.current)output.current.scrollTop=output.current.scrollHeight;},[commands]);
  const run=async()=>{
    if(!window.theseus||!workspace||!draft.trim()||starting||active)return;
    setStarting(true);setError('');follow.current=true;
    try{apply(await window.theseus.startTerminalCommand({workspaceId:workspace.id,command:draft}));update(d=>{d.drafts.terminal='';});}catch(e){setError(e instanceof Error?e.message:'Could not start command.');}finally{setStarting(false);}
  };
  const cancel=async()=>{if(!active||!window.theseus)return;setError('');try{apply(await window.theseus.cancelTerminalCommand(active.id));}catch(e){setError(e instanceof Error?e.message:'Could not stop command.');}};
  return <div className="terminal-page"><header className="terminal-heading"><div><h1><Icon name="term" size={21}/>Terminal</h1><p>Project commands · {shell||'Desktop shell'} · live output</p></div><div className="flex gap-2"><Button disabled={!window.theseus||starting} onClick={()=>void chooseWorkspace().catch(e=>setError(e instanceof Error?e.message:'Could not choose folder.'))}><Icon name="folder" size={13}/>{workspace?'Change project':'Choose project folder'}</Button>{active&&<Button variant="destructive" disabled={active.status==='cancelling'} onClick={()=>void cancel()}>{active.status==='cancelling'?'Stopping…':'Cancel command'}</Button>}</div></header>
    <div className="terminal-location"><Icon name="folder" size={13}/><span>{workspace?.path??'Choose a project folder to begin'}</span><Button size="sm" onClick={onInteractive}>Interactive shell</Button><span role="status">{loading?'Connecting…':active?active.status==='cancelling'?'Cancelling':'Running':'Ready'}</span></div>
    <div className="terminal-output" aria-label="Terminal output" role="log" aria-live="off" ref={output} tabIndex={0} onScroll={e=>{const el=e.currentTarget;follow.current=el.scrollHeight-el.scrollTop-el.clientHeight<50;}}>
      {!commands.length?<div className="terminal-welcome"><Icon name="term" size={27}/><h2>{window.theseus?'Your project shell':'Open Orbit desktop to run commands'}</h2><p>{window.theseus?'Choose a folder, enter a command, and run it. Output streams here as the command executes.':'The browser preview cannot execute processes on your computer.'}</p><code>pwd{ '\n' }git status{ '\n' }pnpm test</code></div>:commands.map(c=><section className="terminal-entry" key={c.id} data-terminal-id={c.id}><div className="terminal-command-meta"><span>{c.projectPath}</span><span>{c.status}{c.exitCode!==undefined?` · exit ${c.exitCode}`:''}</span></div><pre className="terminal-command"><span>$ </span>{c.command}</pre>{c.truncated&&<small className="terminal-truncated">Earlier output trimmed · showing the last 120,000 characters</small>}<pre className="terminal-command-output">{c.output}</pre>{c.error&&<p className="terminal-command-error">{c.error}</p>}</section>)}
    </div>
    <footer className="terminal-composer">{error&&<p role="alert" className="run-error">{error}</p>}<form onSubmit={e=>{e.preventDefault();void run();}}><span className="terminal-prompt">$</span><textarea aria-label="Terminal command" placeholder={workspace?'Enter a command…':'Choose a project folder first…'} rows={2} maxLength={16000} value={draft} disabled={!window.theseus||loading} onChange={e=>update(d=>{d.drafts.terminal=e.target.value;})} onKeyDown={e=>{if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){e.preventDefault();void run();}}}/><Button variant="primary" type="submit" disabled={!window.theseus||!workspace||!draft.trim()||!!active||starting||loading}>{starting?'Starting…':'Run command'}<Icon name="send" size={13}/></Button></form><p>Commands run with your user permissions. Each starts in the selected project; combine steps with <code>&amp;&amp;</code>. Noninteractive shell · ⌘/Ctrl+Enter to run · history lasts until app exit.</p></footer>
  </div>;
}
