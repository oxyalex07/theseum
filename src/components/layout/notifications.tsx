import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '@/state/app-context';
import { desktopDefaults } from '../../../shared/desktop';
import { notificationCandidates, receiveNotifications } from '@/state/notifications';
import { useDesktopSettings } from '../pages/desktop-settings';
import { Icon } from '../common';
import { Button } from '../ui/button';
export function Notifications(){
  const {m,update,select}=useApp();
  const desktop=useDesktopSettings();
  const preferences=desktop.preview?desktopDefaults:desktop.state?.preferences;
  const [decisions,setDecisions]=useState<ReadonlyMap<string,boolean>>(()=>new Map());
  const [open,setOpen]=useState(false),[read,setRead]=useState<Set<string>>(()=>new Set());
  const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);const id=useId();
  const candidates=useMemo(()=>notificationCandidates(m.runs,m.sessions,m.threads),[m.runs,m.sessions,m.threads]);
  useEffect(()=>{
    // Wait for saved desktop preferences before delivering any items.
    if(!preferences)return;
    const now=new Date();
    setDecisions(previous=>receiveNotifications(previous,candidates,preferences,now));
  },[candidates,preferences]);
  const items=candidates.filter(item=>decisions.get(item.id));
  const unread=items.filter(item=>!read.has(item.id)).length;
  const mark=(ids:string[])=>setRead(prev=>new Set([...prev,...ids]));
  useEffect(()=>{setOpen(false);},[m.page,m.selected]);
  useEffect(()=>{
    if(!open)return;
    const dismiss=(e:PointerEvent)=>{if(e.target instanceof Node&&!panel.current?.contains(e.target)&&!trigger.current?.contains(e.target))setOpen(false);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();setOpen(false);trigger.current?.focus();}};
    const resize=()=>setOpen(false);
    document.addEventListener('pointerdown',dismiss);document.addEventListener('keydown',escape);window.addEventListener('resize',resize);
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape);window.removeEventListener('resize',resize);};
  },[open]);
  return <><button ref={trigger} className="ib" aria-label={`Notifications${unread?` · ${unread} unread`:''}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>setOpen(value=>!value)}><Icon name="bell"/>{unread>0&&<span className="dot"/>}</button>
    {open&&createPortal(<div className="notifications-dropdown" ref={panel} id={id} role="dialog" aria-label="Notifications" onBlur={e=>{if(e.relatedTarget instanceof Node&&!panel.current?.contains(e.relatedTarget)&&!trigger.current?.contains(e.relatedTarget))setOpen(false);}}>
      <header><div><h2>Notifications</h2><p>{unread?`${unread} unread`:'You’re all caught up'}</p></div><Button size="sm" variant="ghost" disabled={!unread} onClick={()=>mark(items.map(item=>item.id))}>Mark all read</Button><button className="ib" aria-label="Close notifications" onClick={()=>{setOpen(false);trigger.current?.focus();}}><Icon name="x"/></button></header>
      <div className="notification-list">{items.length?items.map(item=><button className={`notification-item ${read.has(item.id)?'':'unread'}`} key={item.id} onClick={()=>{mark([item.id]);setOpen(false);select(item.session);update(d=>{d.layout='focus';d.showInspector=true;});}}><span className="notification-icon"><Icon name={item.icon} size={16}/></span><span className="notification-content"><span className="notification-title"><b>{item.title}</b><small>{item.sample?'Sample':'Codex run'}</small></span><span className="notification-task">{item.body}</span><small className="notification-detail">{item.detail}</small>{item.time&&<time dateTime={item.time}>{new Date(item.time).toLocaleString()}</time>}</span>{!read.has(item.id)&&<i aria-label="Unread"/>}</button>):<div className="notification-empty"><Icon name="bell" size={24}/><b>No notifications yet</b><p>Run results and sessions needing attention will appear here.</p></div>}</div>
      <footer><span>Preferences apply to new items. Sample items are simulated. Delivery and read state last this session.</span><button onClick={()=>{setOpen(false);update(d=>{d.page='settings';d.section='notify';d.settingsQuery='';});}}>Notification settings<Icon name="right" size={12}/></button></footer>
    </div>,document.body)}
  </>;
}
