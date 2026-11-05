import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useApp } from '@/state/app-context';
import { demoTranscript, pauseDemoSession, resumeDemoSession } from '@/state/session-actions';
import { mockProjects } from '@/data/mock-data';
import type { Session } from '@/types';
import { Icon } from '../common';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import './demo-actions.css';

export function ForkDialog({session,through,commit,onClose}:{session:Session;through?:number;commit?:string;onClose:()=>void}) {
  const {m,fork}=useApp();
  const count=(through??((m.threads[session.id]?.length??0)-1))+1;
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="demo-action-dialog">
    <DialogTitle>Fork demo conversation</DialogTitle>
    <DialogDescription>Create an independent copy of this conversation in the same sample project. Demo sessions reset when the app reloads.</DialogDescription>
    <dl><dt>Source session</dt><dd>{session.t}</dd><dt>Sample project</dt><dd>{mockProjects[session.pj]?.n??session.pj}</dd><dt>Branch label</dt><dd>{session.br??'None'}</dd><dt>Context copied</dt><dd>{count} messages{through!==undefined?' through this displayed error':' through the current end'}, including displayed tool output and pending demo requests. Your unsent draft is excluded.</dd>{commit&&<><dt>Commit reference</dt><dd><code>{commit}</code> · displayed sample reference only</dd></>}</dl>
    <p>No files, Git branch, checkout, reset, or live Codex conversation are created. A commit reference does not reconstruct historical files or conversation state.</p>
    <div className="btns"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={()=>{fork(session.id,through,commit);onClose();}}>Create demo fork</Button></div>
  </DialogContent></Dialog>;
}

export function DemoSessionActions({session:s}:{session:Session}) {
  const {m,update,select}=useApp();
  const [transcript,setTranscript]=useState(false),[forking,setForking]=useState(false),[position,setPosition]=useState<{top:number;right:number}|null>(null);
  const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);const id=useId();
  const close=()=>setPosition(null);
  const open=()=>{const box=trigger.current?.getBoundingClientRect();if(box){setPosition({top:box.bottom+6,right:Math.max(8,window.innerWidth-box.right)});}};
  useLayoutEffect(()=>{if(position)menu.current?.querySelector('button')?.focus();},[!!position]);
  useEffect(()=>{if(!position)return;const dismiss=(e:PointerEvent)=>{if(e.target instanceof Node&&!menu.current?.contains(e.target)&&!trigger.current?.contains(e.target))close();};const resize=()=>close();document.addEventListener('pointerdown',dismiss);window.addEventListener('resize',resize);return()=>{document.removeEventListener('pointerdown',dismiss);window.removeEventListener('resize',resize);};},[position]);
  const actions=[
    {label:'Fork demo conversation…',run:()=>setForking(true)},
    {label:'View demo transcript…',run:()=>setTranscript(true)},
    {label:m.showInspector&&m.inspector==='context'&&m.selected===s.id?'Hide context panel':'Show context panel',run:()=>{const hide=m.showInspector&&m.inspector==='context'&&m.selected===s.id;select(s.id);update(d=>{d.showInspector=!hide;d.inspector='context';d.layout='focus';});}},
    ...(s.forkSource&&m.sessions.some(x=>x.id===s.forkSource!.sessionId)?[{label:'Open source session',run:()=>select(s.forkSource!.sessionId)}]:[]),
  ];
  return <>{['running','thinking','paused'].includes(s.st)&&<button className="ib" aria-label={s.st==='paused'?'Resume demo':'Pause demo'} title={s.st==='paused'?'Resume demo':'Pause demo'} onClick={()=>update(d=>s.st==='paused'?resumeDemoSession(d,s.id):pauseDemoSession(d,s.id))}>{s.st==='paused'?<Play aria-hidden="true" size={14} strokeWidth={1.75}/>:<Icon name="pause"/>}</button>}
    <button className="ib" aria-label="Fork" onClick={()=>setForking(true)}><Icon name="fork"/></button>
    <button className="ib" aria-label={m.layout==='split'?'Close pane':'Open side by side'} onClick={()=>update(d=>{d.layout=d.layout==='split'?'focus':'split';})}><Icon name={m.layout==='split'?'x':'cols'}/></button>
    <button ref={trigger} className="ib" aria-label="More" aria-haspopup="menu" aria-expanded={!!position} aria-controls={position?id:undefined} onClick={()=>position?close():open()} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();open();}}}><Icon name="more"/></button>
    {position&&createPortal(<div id={id} ref={menu} role="menu" aria-label="Demo session actions" className="layout-menu" style={position} onBlur={e=>{if(e.relatedTarget instanceof Node&&!menu.current?.contains(e.relatedTarget)&&!trigger.current?.contains(e.relatedTarget))close();}} onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();trigger.current?.focus();}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const buttons=[...menu.current!.querySelectorAll('button')],i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}}}>{actions.map(action=><button key={action.label} role="menuitem" onClick={()=>{close();trigger.current?.focus();action.run();}}>{action.label}</button>)}</div>,document.body)}
    {forking&&<ForkDialog session={s} onClose={()=>setForking(false)}/>}
    <Dialog open={transcript} onOpenChange={setTranscript}><DialogContent className="demo-action-dialog"><DialogTitle>Demo transcript</DialogTitle><DialogDescription>Conversation text from this demo session. Select the text and use Cmd/Ctrl+C to copy with your system clipboard.</DialogDescription><label htmlFor={`${id}-transcript`}>Transcript</label><textarea id={`${id}-transcript`} readOnly rows={12} value={demoTranscript(s,m.threads[s.id]??[])}/><div className="btns"><Button onClick={()=>setTranscript(false)}>Close</Button></div></DialogContent></Dialog>
  </>;
}
