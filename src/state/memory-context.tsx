import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { MemoryState, SaveMemoryRequest } from '../../shared/memory';
interface MemoryContextValue {
  graph:MemoryState;loading:boolean;error:string;selectedIds:string[];setSelectedIds:(ids:string[])=>void;
  refresh:()=>Promise<void>;save:(request:SaveMemoryRequest)=>Promise<MemoryState>;remove:(id:string)=>Promise<void>;move:(id:string,p:{x:number;y:number})=>Promise<void>;
}
const empty:MemoryState={version:1,revision:0,records:[],positions:{},projects:[]};
const Context=createContext<MemoryContextValue|null>(null);
export function MemoryProvider({children}:{children:ReactNode}){
  const [graph,setGraph]=useState<MemoryState>(empty),[loading,setLoading]=useState(!!window.theseus),[error,setError]=useState(''),[selectedIds,setSelectedIds]=useState<string[]>([]);
  const apply=useCallback((next:MemoryState)=>{setGraph(prev=>prev.revision>next.revision?prev:next);},[]);
  const refresh=useCallback(async()=>{if(!window.theseus)return;try{apply(await window.theseus.getMemoryGraph());setError('');}catch(e){setError(e instanceof Error?e.message:'Memory could not be loaded.');}finally{setLoading(false);}},[apply]);
  useEffect(()=>{void refresh();},[refresh]);
  useEffect(()=>{setSelectedIds(prev=>prev.filter(id=>graph.records.some(r=>r.id===id&&r.status==='current')));},[graph.records]);
  const save=async(request:SaveMemoryRequest)=>{if(!window.theseus)throw new Error('Saving memory requires Electron.');const next=await window.theseus.saveMemory(request);apply(next);return next;};
  const remove=async(id:string)=>{if(!window.theseus)throw new Error('Deleting memory requires Electron.');apply(await window.theseus.deleteMemory(id));};
  const move=async(id:string,p:{x:number;y:number})=>{if(!window.theseus)return;apply(await window.theseus.moveMemoryNode(id,p));};
  return <Context.Provider value={{graph,loading,error,selectedIds,setSelectedIds,refresh,save,remove,move}}>{children}</Context.Provider>;
}
export function useMemory(){const ctx=useContext(Context);if(!ctx)throw new Error('MemoryProvider missing');return ctx;}
