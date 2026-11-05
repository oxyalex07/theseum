// One representation for capture, matching, conflict checks, and persisted bindings.
// ⌘ denotes the primary modifier: Command on macOS or Control on other platforms.
export const defaultKeys = {
  cmdk:'⌘K',new:'⌘N',home:'⌘0',focus:'⌘1',split:'⌘2',grid:'⌘3',
  approve:'⌘↵',next:'J',previous:'K',ad:'A',deny:'D',search:'/',
};
export type KeyboardAction = keyof typeof defaultKeys;
export const keyboardLabels:Record<KeyboardAction,string> = {
  cmdk:'Ask Theseus or run a command',new:'New session',home:'Go to Home',
  focus:'Focus layout',split:'Split layout',grid:'Grid layout',approve:'Approve the waiting request',
  next:'Next session',previous:'Previous session',ad:'Approve selected request',deny:'Deny selected request',search:'Search settings',
};
const namedKeys=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown','Backspace','Delete','Tab'];
export function normalizeBinding(value:unknown):string|null {
  if(typeof value!=='string')return null;
  const [,mods='',raw='']=value.match(/^([⌃⌥⇧⌘]*)(.*)$/u)??[];
  const key=raw==='Enter'?'↵':raw===' '?'Space':raw.length===1?raw.toUpperCase():raw;
  if(!key||(!namedKeys.includes(key)&&key!=='Space'&&key!=='↵'&&!(key.length===1&&!/[\s⌃⌥⇧⌘]/u.test(key))&&!/^F([1-9]|1[0-2])$/.test(key)))return null;
  return (/[⌃⌘]/u.test(mods)?'⌘':'')+(mods.includes('⌥')?'⌥':'')+(mods.includes('⇧')?'⇧':'')+key;
}
export interface KeyEvent { key:string; code:string; ctrlKey:boolean; metaKey:boolean; altKey:boolean; shiftKey:boolean; isComposing:boolean; repeat:boolean; keyCode:number }
export function eventBinding(event:KeyEvent):string|null {
  if(event.isComposing||event.keyCode===229||event.repeat||['Control','Meta','Shift','Alt','AltGraph','Dead','Unidentified','Process','Escape'].includes(event.key))return null;
  // Option-letter combinations on macOS report a composed symbol as `key`.
  const key=event.altKey&&/^(Key[A-Z]|Digit[0-9])$/.test(event.code)?event.code.replace(/^(Key|Digit)/,''):event.key;
  return normalizeBinding((event.ctrlKey||event.metaKey?'⌘':'')+(event.altKey?'⌥':'')+(event.shiftKey?'⇧':'')+key);
}
export function bindingConflict(keys:Record<string,string>,id:string,binding:string):boolean {
  return Object.entries(keys).some(([other,value])=>other!==id&&normalizeBinding(value)===normalizeBinding(binding));
}
export function keyboardPreferences(value:unknown):Partial<Record<KeyboardAction,string>> {
  if(!value||typeof value!=='object'||Array.isArray(value))return {};
  const result:Partial<Record<KeyboardAction,string>>={};
  for(const id of Object.keys(defaultKeys) as KeyboardAction[]){
    const binding=normalizeBinding((value as Record<string,unknown>)[id]);
    if(binding)result[id]=binding;
  }
  // Invalid/duplicate imported stores must never shadow another action.
  const merged={...defaultKeys,...result};
  if(Object.entries(merged).some(([id,binding])=>bindingConflict(merged,id,binding)))return {};
  return result;
}
