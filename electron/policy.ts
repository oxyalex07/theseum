import type { MemoryExport, WindowAction } from '../shared/bridge';
export function validateMemory(value: unknown): MemoryExport {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid memory');
  const entries=Object.entries(value);
  if(entries.length>30)throw new Error('Too many memory groups');
  for(const [key,items] of entries){
    if(!/^[a-zA-Z0-9_-]{1,40}$/.test(key)||['__proto__','constructor','prototype'].includes(key)||!Array.isArray(items)||items.length>500||items.some(x=>typeof x!=='string'||x.length>10000))throw new Error('Invalid memory group');
  }
  if(JSON.stringify(value).length>1_000_000)throw new Error('Memory export too large');
  return value as MemoryExport;
}
export function validateWindowAction(value: unknown): WindowAction {
  if(value!=='minimize'&&value!=='maximize'&&value!=='close')throw new Error('Invalid window action');
  return value;
}
export function isTrustedFrame(url: string, expected: string): boolean {
  try {const actual=new URL(url),target=new URL(expected);actual.search='';actual.hash='';target.search='';target.hash='';return actual.href===target.href;}catch{return false;}
}
