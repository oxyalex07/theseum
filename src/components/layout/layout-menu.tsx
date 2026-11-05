import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Layout } from '@/types';
import { Icon } from '../common';
const layouts=[{id:'focus',icon:'sq',label:'Focus'},{id:'split',icon:'cols',label:'Split'},{id:'grid',icon:'grid',label:'Grid'}] as const;
export function LayoutMenu({layout,onSelect}:{layout:Layout;onSelect:(layout:Layout)=>void}){
  const [position,setPosition]=useState<{top:number;right:number}|null>(null);
  const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const id=useId();const current=layouts.find(item=>item.id===layout)!;
  const cancelClose=()=>{clearTimeout(timer.current);};
  const close=()=>{cancelClose();setPosition(null);};
  const open=()=>{cancelClose();const box=trigger.current?.getBoundingClientRect();if(box)setPosition({top:box.bottom+6,right:Math.max(8,window.innerWidth-box.right)});};
  const leave=()=>{cancelClose();timer.current=setTimeout(()=>setPosition(null),140);};
  const blur=(target:EventTarget|null)=>{if(target instanceof Node&&(trigger.current?.contains(target)||menu.current?.contains(target)))return;close();};
  useEffect(()=>{close();},[layout]);
  useEffect(()=>{if(!position)return;const dismiss=(e:PointerEvent)=>{if(e.target instanceof Node&&!trigger.current?.contains(e.target)&&!menu.current?.contains(e.target))close();};const reposition=()=>close();document.addEventListener('pointerdown',dismiss);window.addEventListener('resize',reposition);return()=>{document.removeEventListener('pointerdown',dismiss);window.removeEventListener('resize',reposition);};},[position]);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  return <><button ref={trigger} className="layout-trigger" aria-label={`Current view: ${current.label}`} aria-haspopup="menu" aria-expanded={!!position} aria-controls={position?id:undefined} onMouseEnter={open} onMouseLeave={leave} onClick={()=>position?close():open()} onBlur={e=>blur(e.relatedTarget)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();open();requestAnimationFrame(()=>menu.current?.querySelector('button')?.focus());}else if(e.key==='Escape'){e.preventDefault();close();}}}><Icon name={current.icon} size={12}/>{current.label}<Icon name="down" size={12}/></button>
    {position&&createPortal(<div ref={menu} id={id} role="menu" aria-label="Change view" className="layout-menu" style={position} onMouseEnter={cancelClose} onMouseLeave={leave} onBlur={e=>blur(e.relatedTarget)} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();trigger.current?.focus();}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const buttons=[...menu.current!.querySelectorAll('button')];const i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}}}>{layouts.filter(item=>item.id!==layout).map(item=><button key={item.id} role="menuitem" onClick={()=>{onSelect(item.id);close();trigger.current?.focus();}}><Icon name={item.icon} size={13}/>{item.label}</button>)}</div>,document.body)}
  </>;
}
