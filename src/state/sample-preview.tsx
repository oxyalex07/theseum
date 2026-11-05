import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
const key='orbit.sample-preview';
const Context=createContext<{samples:boolean;setSamples:(value:boolean)=>void}|null>(null);
export function SamplePreviewProvider({children}:{children:ReactNode}){
  const [samples,setSamples]=useState(()=>{
    const requested=new URLSearchParams(location.search).get('samples');
    if(requested!==null)return requested==='1';
    try{return localStorage.getItem(key)==='1';}catch{return false;}
  });
  useEffect(()=>{try{localStorage.setItem(key,samples?'1':'0');}catch{/* Cosmetic preference only. */}},[samples]);
  return <Context.Provider value={{samples,setSamples}}>{children}</Context.Provider>;
}
export function useSamplePreview(){const value=useContext(Context);if(!value)throw new Error('SamplePreviewProvider missing');return value;}
export function SamplePreviewToggle(){
  const {samples,setSamples}=useSamplePreview();
  return <div className="sample-preview-banner"><span><b>{samples?'Sample preview':'Saved data'}</b><small>{samples?'Fictional agents and memories · never saved or sent to Codex':'Preview a populated app with fictional data.'}</small></span><Button size="sm" onClick={()=>setSamples(!samples)}>{samples?'Show saved data':'Show sample data'}</Button></div>;
}
