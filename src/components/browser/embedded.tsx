import { useEffect, useRef } from 'react';
import type { BrowsingState, BrowserCommand } from '../../../shared/browsing';
import { Button } from '../ui/button';
export function EmbeddedControls({state,command,onError}:{state:BrowsingState|null;command:(c:BrowserCommand)=>Promise<void>;onError:(message:string)=>void}){
  const slot=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const node=slot.current,bridge=window.theseus;if(!node||!bridge)return;
    let frame=0;
    const update=()=>{
      cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
        const rect=node.getBoundingClientRect(),container=node.closest('.page')?.getBoundingClientRect();
        const x=Math.max(0,rect.left),y=Math.max(rect.top,container?.top??0),right=Math.min(rect.right,window.innerWidth),bottom=Math.min(rect.bottom,container?.bottom??window.innerHeight);
        void bridge.setBrowserBounds(!document.querySelector('[role=dialog], [role=menu]')&&right-x>50&&bottom-y>50?{x,y,width:right-x,height:bottom-y}:null).catch(e=>onError(e.message));
      });
    };
    const observer=new ResizeObserver(update);observer.observe(node);const mutations=new MutationObserver(update);mutations.observe(document.body,{childList:true,subtree:true});window.addEventListener('resize',update);window.addEventListener('scroll',update,true);update();
    return()=>{observer.disconnect();mutations.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);cancelAnimationFrame(frame);void bridge.setBrowserBounds(null).catch(()=>{});};
  },[]);
  let origin='';try{origin=new URL(state?.url??'').origin;}catch{/* no page */}
  return <section className="embedded-browser" aria-label="Embedded browser">
    <div className="browser-tools"><Button size="sm" aria-label="Back" onClick={()=>void command({action:'back'})}>Back</Button><Button size="sm" aria-label="Forward" onClick={()=>void command({action:'forward'})}>Forward</Button><Button size="sm" disabled={!state?.url} onClick={()=>void command({action:'reload'})}>Reload</Button><span className="trunc" role="status">{state?.loading?'Loading…':state?.title||'Enter an address to start browsing'}</span><Button size="sm" disabled={!state?.url||state.loading} onClick={()=>void command({action:'extract'})}>Extract page</Button></div>
    <div ref={slot} className="browser-viewport" aria-label="Web page viewport"/>
    {state?.error&&<p role="alert" className="run-error">{state.error}</p>}
    <label className="browser-option"><input type="checkbox" checked={!!state?.allowedOrigin} disabled={!origin||state?.loading} onChange={e=>void command({action:'grant',origin:e.target.checked?origin:null})}/><span>Allow agents to read and follow links on <b>{origin||'this site'}</b></span></label>
    <p className="browser-note">Access ends when you leave Browser or change sites. Agents can read and navigate; forms and arbitrary scripts are unavailable. Downloads, pop-ups, and device permissions are blocked.</p>
    {state?.activity.length? <details className="browser-activity"><summary>Browser activity · {state.activity[0].actor}: {state.activity[0].action}</summary><ol>{state.activity.map((a,i)=><li key={i}><time>{new Date(a.at).toLocaleTimeString()}</time> · {a.actor} · {a.action}</li>)}</ol></details>:null}
  </section>;
}
