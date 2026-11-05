import { useEffect, useRef, useState } from 'react';
import type { DesktopPreferences, DesktopState, UpdateResult } from '../../../shared/desktop';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';

export function useDesktopSettings(){
  const [state,setState]=useState<DesktopState|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const saving=useRef(false);
  useEffect(()=>{
    if(!window.theseus)return;
    let active=true;
    const receive=(value:DesktopState)=>{if(active)setState(value);};
    const unsubscribe=window.theseus.onDesktopState(receive);
    void window.theseus.getDesktopState().then(receive).catch(e=>{if(active)setError(String(e));});
    return()=>{active=false;unsubscribe();};
  },[]);
  async function save(patch:Partial<DesktopPreferences>){
    if(!window.theseus||saving.current)return;
    saving.current=true;setBusy(true);setError('');
    try{setState(await window.theseus.saveDesktopPreferences(patch));}
    catch(e){setError(e instanceof Error?e.message:'Could not save desktop preferences. Try again.');}
    finally{saving.current=false;setBusy(false);}
  }
  const disabled=!window.theseus||!state||busy;
  const toggle=(key:Exclude<keyof DesktopPreferences,'deliver'|'deep'|'slots'|'overflow'>,label:string)=><Switch aria-label={label} checked={state?.preferences[key]??false} disabled={disabled||key==='login'&&!state?.loginSupported} onCheckedChange={value=>void save({[key]:value})}/>;
  const segmented=(key:'deliver'|'deep',label:string,options:[string,string][])=><div className="seg" role="radiogroup" aria-label={label}>{options.map(([value,text])=><button key={value} disabled={disabled} role="radio" aria-checked={state?.preferences[key]===value} className={state?.preferences[key]===value?'on':''} onClick={()=>void save({[key]:value} as Partial<DesktopPreferences>)}>{text}</button>)}</div>;
  return {state,save,disabled,toggle,segmented,error:error||state?.warning,preview:!window.theseus};
}

export function UpdateControl(){
  const [result,setResult]=useState<UpdateResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function act(open=false){
    if(!window.theseus)return;
    setBusy(true);setError('');
    try{if(open)await window.theseus.openUpdateRelease();else setResult(await window.theseus.checkUpdates());}
    catch(e){setError(e instanceof Error?e.message:'Update check failed. Try again.');}
    finally{setBusy(false);}
  }
  return <div className="mt-3">
    <div className="btns"><Button size="sm" disabled={busy||!window.theseus} onClick={()=>void act()}>{busy?'Working…':'Check for updates'}</Button>{result?.releaseUrl&&<Button size="sm" disabled={busy} onClick={()=>void act(true)}>{result.status==='available'?'Download release…':'View releases…'}</Button>}</div>
    {result&&<p role="status" className="demo-note mt-3">{result.message}</p>}
    {error&&<p role="alert" className="run-error mt-3">{error}</p>}
  </div>;
}
