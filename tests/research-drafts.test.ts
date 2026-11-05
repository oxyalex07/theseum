import { describe, expect, it } from 'vitest';
import { ResearchDraftStore, researchDraftKey } from '../src/state/research-drafts';
import type { ResearchDocument } from '../shared/research';
const runId='12345678-1234-1234-1234-123456789abc';
const document:ResearchDocument={version:1,runId,projectPath:'/fixture',runRevision:1,revision:3,collectedAt:new Date().toISOString(),truncated:false,sources:[],artifacts:{draft:{kind:'draft',content:'Original',updatedAt:new Date().toISOString(),resultHashes:[]},outline:{kind:'outline',content:'Outline',updatedAt:new Date().toISOString(),resultHashes:[]}}};
function fixture(){const data=new Map<string,string>();const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};return {data,storage,store:new ResearchDraftStore(storage)};}
describe('recoverable Research drafts',()=>{
  it('persists only known-local sibling revision advances without changing text, base, time or other runs',()=>{
    const f=fixture();f.store.edit(document,'draft','Saved draft');f.store.edit(document,'outline','Local outline');
    const other={...document,runId:'87654321-1234-1234-1234-123456789abc'};f.store.edit(other,'outline','Other run');
    const prior=structuredClone(f.store.getSnapshot().drafts),after=structuredClone(document);after.revision++;after.artifacts.draft!.content='Saved draft';
    f.store.acceptLocalChange(document,after,'draft');
    expect(new ResearchDraftStore(f.storage).getSnapshot().drafts).toEqual([{...prior[1],revision:after.revision},prior[2]]);
  });
  it('ignores key order at every object depth while preserving ordered arrays and all fields',()=>{
    const before=structuredClone(document);
    before.sources=[{id:'S1',url:'https://example.test',title:'Source',evidence:[{origin:'output-link',sequence:1,capturedAt:'2026-11-01T00:00:00Z',sha256:'a'.repeat(64),excerpt:'First'},{origin:'output-link',sequence:2,capturedAt:'2026-11-01T00:00:00Z',sha256:'b'.repeat(64),excerpt:'Second'}]}];
    before.artifacts.outline!.resultHashes=['a'.repeat(64),'b'.repeat(64)];
    const after=JSON.parse(JSON.stringify(before,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).reverse()):value)) as ResearchDocument;
    after.revision++;after.artifacts.draft!.content='Saved draft';
    const f=fixture();f.store.edit(before,'outline','Local outline');f.store.acceptLocalChange(before,after,'draft');
    expect(new ResearchDraftStore(f.storage).getSnapshot().drafts[0]).toMatchObject({revision:after.revision,content:'Local outline',baseContent:'Outline'});
    for(const mutate of [
      (d:ResearchDocument)=>{d.sources[0].evidence.reverse();},
      (d:ResearchDocument)=>{d.artifacts.outline!.resultHashes.reverse();},
      (d:ResearchDocument)=>{d.sources[0].evidence[0].excerpt='External evidence';},
      (d:ResearchDocument)=>{d.sources[0].title='External title';},
      (d:ResearchDocument)=>{Object.assign(d,{unexpected:'external field'});},
    ]){
      const g=fixture();g.store.edit(before,'outline','Local outline');const prior=g.store.getSnapshot().drafts;
      const external=structuredClone(after);mutate(external);g.store.acceptLocalChange(before,external,'draft');
      expect(new ResearchDraftStore(g.storage).getSnapshot().drafts).toEqual(prior);
    }
  });
  it('does not bless stale bases/revisions, changed projects, sources or external sibling mutations',()=>{
    const after=structuredClone(document);after.revision++;after.artifacts.draft!.content='Saved draft';
    for(const mutate of [
      (d:ResearchDocument)=>{d.revision++;},
      (d:ResearchDocument)=>{d.version=2 as 1;},
      (d:ResearchDocument)=>{d.runId='87654321-1234-1234-1234-123456789abc';},
      (d:ResearchDocument)=>{d.collectedAt='2026-11-01T00:00:00Z';},
      (d:ResearchDocument)=>{d.truncated=!d.truncated;},
      (d:ResearchDocument)=>{delete d.artifacts.outline;},
      (d:ResearchDocument)=>{d.projectPath='/other';},
      (d:ResearchDocument)=>{d.runRevision++;},
      (d:ResearchDocument)=>{d.artifacts.outline!.content='External outline';},
      (d:ResearchDocument)=>{d.artifacts.outline!.updatedAt='2026-11-01T00:00:00Z';},
      (d:ResearchDocument)=>{d.sources.push({id:'S1',url:'https://example.test',title:'External source',evidence:[]});},
    ]){
      const f=fixture();f.store.edit(document,'outline','Local outline');const original=f.store.getSnapshot().drafts;
      const unexpected=structuredClone(after);mutate(unexpected);f.store.acceptLocalChange(document,unexpected,'draft');
      expect(new ResearchDraftStore(f.storage).getSnapshot().drafts).toEqual(original);
    }
    for(const base of [{...document,revision:document.revision-1},{...document,projectPath:'/old-project'}]){
      const f=fixture();f.store.edit(base,'outline','Stale draft');const original=f.store.getSnapshot().drafts;
      f.store.acceptLocalChange(document,after,'draft');expect(f.store.getSnapshot().drafts).toEqual(original);
    }
    const f=fixture();const stale=structuredClone(document);stale.artifacts.outline!.content='Old base';f.store.edit(stale,'outline','Stale content');
    const original=f.store.getSnapshot().drafts;f.store.acceptLocalChange(document,after,'draft');expect(f.store.getSnapshot().drafts).toEqual(original);
  });
  it('reconciles when creating a sibling artifact and retains a newer same-artifact edit during a pending save',()=>{
    const f=fixture();f.store.edit(document,'draft','Newer local draft');const created=structuredClone(document);created.revision++;
    created.artifacts.comparison={kind:'comparison',content:'New comparison',updatedAt:new Date().toISOString(),resultHashes:[]};
    f.store.acceptLocalChange(document,created,'comparison');expect(f.store.getSnapshot().drafts[0].revision).toBe(created.revision);
    const saved=structuredClone(created);saved.revision++;saved.artifacts.draft!.content='Earlier pending edit';
    f.store.acceptLocalChange(created,saved,'draft');expect(new ResearchDraftStore(f.storage).getSnapshot().drafts[0]).toMatchObject({content:'Newer local draft',baseContent:'Original',revision:created.revision});
  });
  it('writes each keystroke synchronously and recovers independent run/artifact drafts with their original provenance',()=>{
    const f=fixture();f.store.edit(document,'draft','UNSAVED_USER_RESEARCH');
    f.store.edit({...document,revision:4},'draft','UNSAVED_USER_RESEARCH revised');
    f.store.edit(document,'outline','Edited outline');
    f.store.edit({...document,runId:'87654321-1234-1234-1234-123456789abc'},'draft','Other run');
    const recovered=new ResearchDraftStore(f.storage).getSnapshot();expect(recovered.warning).toBe('');expect(recovered.drafts).toHaveLength(3);
    expect(recovered.drafts[0]).toMatchObject({revision:3,baseContent:'Original',projectPath:'/fixture',content:'UNSAVED_USER_RESEARCH revised'});
    f.store.discard(runId,'outline');expect(new ResearchDraftStore(f.storage).getSnapshot().drafts.map(d=>d.content)).toEqual(['UNSAVED_USER_RESEARCH revised','Other run']);
    f.store.discard(runId);expect(f.store.getSnapshot().drafts.map(d=>d.content)).toEqual(['Other run']);
  });
  it('retains edits in memory and warns on quota/write failure; a later successful write restores recovery',()=>{
    const f=fixture();let fail=true;const store=new ResearchDraftStore({...f.storage,setItem:(key,value)=>{if(fail)throw new Error('quota');f.storage.setItem(key,value);}});
    expect(store.edit(document,'draft','Keep this text')).toBe(false);expect(store.getSnapshot().drafts[0].content).toBe('Keep this text');expect(store.getSnapshot().warning).toMatch(/Keep this window open/);
    fail=false;expect(store.edit(document,'draft','Keep this text too')).toBe(true);expect(store.getSnapshot().warning).toBe('');expect(new ResearchDraftStore(f.storage).getSnapshot().drafts[0].content).toBe('Keep this text too');
  });
  it('preserves damaged data instead of overwriting it and blocks unsafe edits',()=>{
    const f=fixture();f.data.set(researchDraftKey,'{"version":1,"drafts":[{"runId":"../../bad"}]}');const store=new ResearchDraftStore(f.storage);
    expect(store.getSnapshot().warning).toMatch(/preserved/);expect(()=>store.edit(document,'draft','new text')).toThrow(/preserved/);expect(f.data.get(researchDraftKey)).toContain('../../bad');
  });
  it('keeps text reverted to the original base when the saved artifact has since changed',()=>{
    const f=fixture();f.store.edit(document,'draft','Local edit');
    const changed=structuredClone(document);changed.revision++;changed.artifacts.draft!.content='External change';
    f.store.edit(changed,'draft','Original');
    expect(f.store.getSnapshot().drafts).toEqual([expect.objectContaining({content:'Original',baseContent:'Original',revision:3})]);
    f.store.edit(changed,'draft','External change');expect(f.store.getSnapshot().drafts).toEqual([]);
  });
  it('removes a reverted draft without rebasing another artifact revision',()=>{
    const f=fixture();f.store.edit(document,'draft','Edit');f.store.edit(document,'outline','Outline edit');f.store.edit({...document,revision:5},'draft','Original');
    expect(f.store.getSnapshot().drafts).toEqual([expect.objectContaining({kind:'outline',revision:3})]);
  });
});
