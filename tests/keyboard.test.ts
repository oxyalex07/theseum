import { describe, expect, it } from 'vitest';
import { bindingConflict, defaultKeys, eventBinding, keyboardPreferences, normalizeBinding, type KeyEvent } from '../src/state/keyboard';
import { readPreferences, writePreferences } from '../src/state/preferences';
import { createModel } from '../src/state/model';
const event=(key:string,extra:Partial<KeyEvent>={})=>({key,code:'',ctrlKey:false,metaKey:false,altKey:false,shiftKey:false,isComposing:false,repeat:false,keyCode:0,...extra});
describe('keyboard bindings',()=>{
 it('normalizes casing, primary modifiers, modifier order and Enter consistently',()=>{
  expect(eventBinding(event('f'))).toBe(normalizeBinding('F'));
  expect(eventBinding(event('f',{ctrlKey:true,altKey:true,shiftKey:true}))).toBe('⌘⌥⇧F');
  expect(normalizeBinding('⇧⌃⌥f')).toBe('⌘⌥⇧F');
  expect(eventBinding(event('Enter',{metaKey:true}))).toBe(defaultKeys.approve);
  expect(eventBinding(event('f',{shiftKey:true}))).not.toBe('F');
  expect(eventBinding(event('ƒ',{code:'KeyF',altKey:true}))).toBe('⌥F');
  expect(eventBinding(event(' '))).toBe('Space');
 });
 it('ignores composition, repeats, standalone modifiers and reserved/unsupported keys',()=>{
  for(const key of ['Control','Meta','Shift','Alt','AltGraph','Dead','Process','Unidentified','Escape'])expect(eventBinding(event(key))).toBeNull();
  for(const extra of [{isComposing:true},{repeat:true},{keyCode:229}])expect(eventBinding(event('a',extra))).toBeNull();
  for(const binding of ['','J / K','Escape','⌘','Something',null,{}])expect(normalizeBinding(binding)).toBeNull();
 });
 it('rejects duplicate aliases and validates persisted action names and bindings',()=>{
  expect(bindingConflict(defaultKeys,'search','⌃k')).toBe(true);
  expect(bindingConflict(defaultKeys,'search','⌘⇧K')).toBe(false);
  expect(keyboardPreferences({next:'x',previous:'y',ad:'u',deny:'v',search:'⌃f',unknown:'z'})).toEqual({next:'X',previous:'Y',ad:'U',deny:'V',search:'⌘F'});
  expect(keyboardPreferences({search:'⌃k'})).toEqual({});
  expect(keyboardPreferences({next:'J / K',ad:'A / D',search:123})).toEqual({});
 });
 it('persists separate paired actions with General preferences and hydrates without changing defaults',()=>{
  let saved='';const storage={getItem:()=>saved,setItem:(_key:string,value:string)=>{saved=value;}};
  const keys={...defaultKeys,next:'X',previous:'Y',ad:'U',deny:'V',search:'⌘F'};
  writePreferences(storage,{dview:'grid',density:'compact',start:'last'},'c1',keys);
  const prefs=readPreferences(storage);const model=createModel('',prefs);
  expect(model.settings.keys).toEqual(keys);expect(model.layout).toBe('grid');expect(model.selected).toBe('c1');
  writePreferences(storage,{dview:'split'},'c2');expect(readPreferences(storage).keyboard).toEqual(keys);
  expect(createModel().settings.keys).toEqual(defaultKeys);
  writePreferences(storage,{},undefined,defaultKeys);expect(createModel('',readPreferences(storage)).settings.keys).toEqual(defaultKeys);
 });
});
