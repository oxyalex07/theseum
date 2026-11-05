import { describe, expect, it } from 'vitest';
import { readPreferences, writePreferences, PREFERENCES_KEY } from '../src/state/preferences';
import { applyAgentRun, applyNewSessionDefaults, createModel, restoreStartupSession, selectSession } from '../src/state/model';
import type { AgentRun } from '../shared/bridge';
function storage(initial:string|null=null){let value=initial;return {getItem:()=>value,setItem:(_key:string,next:string)=>{value=next;}};}
describe('renderer preferences',()=>{
 it('round trips supported values and preserves a future namespace',()=>{
  const store=storage(JSON.stringify({version:1,general:{},keyboard:{example:'Cmd+K'}}));
  writePreferences(store,{start:'last',dspace:'research',dview:'split',dag:'quill',density:'compact',toolsCollapsed:0,login:true},'c2');
  const prefs=readPreferences(store);expect(prefs.general).toEqual({start:'last',dspace:'research',dview:'split',dag:'quill',density:'compact',toolsCollapsed:false});expect(prefs.lastSession).toBe('c2');
  expect(JSON.parse(store.getItem()!).keyboard).toEqual({example:'Cmd+K'});expect(PREFERENCES_KEY).toBe('theseus.renderer-preferences');
 });
 it('validates malformed, future and partially invalid stores',()=>{
  for(const value of ['broken','null','[]','{"version":2,"general":{}}'])expect(readPreferences(storage(value))).toEqual({version:1,general:{}});
  expect(readPreferences(storage(JSON.stringify({version:1,general:{start:'shell',dview:'wrong',dspace:'code',dag:'profile:abc-123',toolsCollapsed:'false'}}))).general).toEqual({dspace:'code',dag:'profile:abc-123'});
  expect(readPreferences({getItem:()=>{throw Error('denied');},setItem:()=>{}}).general).toEqual({});
 });
 it('applies launch defaults and explicit navigation overrides without mutating mock defaults',()=>{
  const prefs={version:1 as const,general:{start:'last',dspace:'research',dview:'grid',dag:'quill'},lastSession:'r2'};
  const m=createModel('',prefs);expect([m.page,m.selected,m.space,m.layout,m.homeAgent]).toEqual(['session','r2','research','grid','quill']);
  const explicit=createModel('?page=settings&s=c1&view=split&space=code',prefs);expect([explicit.page,explicit.selected,explicit.layout,explicit.space]).toEqual(['settings','c1','split','code']);
  expect(createModel().homeAgent).toBe('orbit');expect(createModel().layout).toBe('focus');
 });
 it('applies layout at session creation and records the last selected conversation',()=>{
  const m=createModel();m.settings.values.dview='split';m.layout='grid';selectSession(m,'r1');applyNewSessionDefaults(m);expect(m.layout).toBe('split');expect(m.lastSession).toBe('r1');selectSession(m,'missing');expect(m.lastSession).toBe('r1');
 });
 it('waits for recovered live history, opens it without changing run truth, and falls back safely',()=>{
  const prefs={version:1 as const,general:{start:'last'},lastSession:'live-id'};
  const m=createModel('',prefs);expect(m.page).toBe('home');expect(m.pendingStartupSession).toBe('live-id');
  const run={id:'live-id',revision:1,status:'interrupted',projectName:'fixture',task:'saved',output:[],startedAt:new Date().toISOString()} as unknown as AgentRun;
  applyAgentRun(m,run);restoreStartupSession(m);expect(m.page).toBe('session');expect(m.selected).toBe(run.id);expect(m.runs[run.id].status).toBe('interrupted');expect(m.pendingStartupSession).toBeUndefined();
  const missing=createModel('',prefs);restoreStartupSession(missing);expect(missing.page).toBe('home');
  const explicit=createModel('?page=home',prefs);applyAgentRun(explicit,run);restoreStartupSession(explicit);expect(explicit.page).toBe('home');
  const settings=createModel('?page=settings&s=live-id',prefs);applyAgentRun(settings,run);restoreStartupSession(settings);expect(settings.page).toBe('settings');
 });
});
