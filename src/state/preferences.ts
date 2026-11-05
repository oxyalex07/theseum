import { keyboardPreferences } from './keyboard';
import type { Settings } from '../types';

// Shared renderer envelope: add validated namespaces here for future preferences.
export const PREFERENCES_KEY = 'theseus.renderer-preferences';
export interface RendererPreferences { version:1; general:Partial<Settings['values']>; lastSession?:string; keyboard?:Record<string,string> }
interface StorageAccess { getItem(key:string):string|null; setItem(key:string,value:string):void }
const choices:Record<string,readonly string[]> = {
  start:['home','last'], dspace:['all','code','research'], dview:['focus','split','grid'],
  dag:['orbit','forge','sentinel','scout','quill'], density:['comfortable','compact'],
};
export function generalPreferences(values:Settings['values']):Partial<Settings['values']> {
  const result:Partial<Settings['values']>={};
  for(const [key,allowed] of Object.entries(choices)){
    const value=values[key];
    if(typeof value==='string'&&(allowed.includes(value)||(key==='dag'&&/^profile:[a-zA-Z0-9_-]{1,128}$/.test(value))))result[key]=value;
  }
  if(typeof values.toolsCollapsed==='boolean'||values.toolsCollapsed===0||values.toolsCollapsed===1)result.toolsCollapsed=!!values.toolsCollapsed;
  return result;
}
export function readPreferences(storage:StorageAccess):RendererPreferences {
  try{
    const data=JSON.parse(storage.getItem(PREFERENCES_KEY)??'null');
    if(data?.version===1&&data.general&&typeof data.general==='object'&&!Array.isArray(data.general))return {
      version:1,general:generalPreferences(data.general),
      ...(data.keyboard?{keyboard:keyboardPreferences(data.keyboard)}:{}),
      ...(typeof data.lastSession==='string'&&data.lastSession.length<=128?{lastSession:data.lastSession}:{}),
    };
  }catch{/* Invalid or unavailable storage uses the visible defaults. */}
  return {version:1,general:{}};
}
export function writePreferences(storage:StorageAccess,values:Settings['values'],lastSession?:string,keys?:Record<string,string>):void {
  // Preserve other preference namespaces when saving General or Keyboard settings.
  let existing:Record<string,unknown>={};
  try{const data=JSON.parse(storage.getItem(PREFERENCES_KEY)??'null');if(data?.version===1)existing=data;}catch{/* Repair malformed data on the next save. */}
  storage.setItem(PREFERENCES_KEY,JSON.stringify({...existing,version:1,general:generalPreferences(values),...(keys?{keyboard:keyboardPreferences(keys)}:{}),...(lastSession?{lastSession}:{})}));
}
