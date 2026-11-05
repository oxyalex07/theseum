import { useEffect, useState, useSyncExternalStore } from 'react';
import { researchDrafts, researchError, type ResearchDraft } from '@/state/research-drafts';
import { useApp } from '@/state/app-context';
import { selectSession } from '@/state/model';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';

/** Remains mounted outside Research, including Home and other sessions. */
export function ResearchDraftRecovery(){
  const store=researchDrafts(),{drafts,warning}=useSyncExternalStore(store.subscribe,store.getSnapshot);
  const {m,update}=useApp();
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const save=async(draft:ResearchDraft)=>{
    if(busy)return;setBusy(true);setError('');
    try{
      const state=await window.theseus!.getResearch({runId:draft.runId});
      if(state.document?.projectPath!==draft.projectPath)throw new Error('The Research project changed. Your draft is kept.');
      const saved=await window.theseus!.saveResearch({runId:draft.runId,kind:draft.kind,revision:draft.revision,content:draft.content,baseContent:draft.baseContent,projectPath:draft.projectPath});
      if(saved.document)store.acceptLocalChange(state.document,saved.document,draft.kind);
      window.dispatchEvent(new CustomEvent('theseus:research-saved',{detail:saved}));
    }catch(e){setError(researchError(e,'Could not save. Your draft is kept.'));}finally{setBusy(false);}
  };
  useEffect(()=>{
    if(!drafts.length)return;
    const guard=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    window.addEventListener('beforeunload',guard);return()=>window.removeEventListener('beforeunload',guard);
  },[drafts.length]);
  if(!drafts.length&&!warning&&!open)return null;
  return <>
    <div className="research-draft-recovery" role="region" aria-label="Recoverable Research drafts">
      <Button size="sm" title={warning||undefined} onClick={()=>setOpen(true)}>Research drafts ({drafts.length}) · {warning?'needs attention':'save or discard'}</Button>
    </div>
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent className="research-draft-dialog">
      <DialogTitle>Recoverable Research drafts</DialogTitle>
      <DialogDescription>{warning?'Save your edits before leaving while draft storage needs attention.':'Drafts stay on this device through navigation, reload and quit.'} Save to update the artifact, or deliberately discard an individual draft.</DialogDescription>
      {warning&&<p role="alert" className="run-error">{warning}</p>}
      {error&&<p role="alert" className="run-error">{error}</p>}
      <div className="research-draft-list">{drafts.map(draft=><section key={`${draft.runId}/${draft.kind}`} aria-label={`${draft.kind} draft for ${draft.runId}`}>
        <p><b>{draft.kind}</b> · {m.runs[draft.runId]?.task??draft.runId}</p>
        <small>Edited {new Date(draft.updatedAt).toLocaleString()} · based on revision {draft.revision}</small>
        <pre>{draft.content}</pre>
        <div className="research-actions">
          <Button size="sm" disabled={busy||!window.theseus} onClick={()=>void save(draft)}>Save {draft.kind}</Button>
          <Button size="sm" disabled={busy} onClick={()=>{store.discard(draft.runId,draft.kind);setError('');}}>Discard {draft.kind} edits</Button>
          <Button size="sm" disabled={busy||!m.runs[draft.runId]} onClick={()=>{update(d=>{selectSession(d,draft.runId);d.layout='focus';d.showInspector=true;d.runInspectorViews[draft.runId]={tab:'research',artifactKind:draft.kind};});setOpen(false);}}>Open Research</Button>
        </div>
      </section>)}</div>
      {!drafts.length&&<p>No unsaved Research drafts.</p>}
      <Button onClick={()=>setOpen(false)} disabled={busy}>Keep drafts and close</Button>
    </DialogContent></Dialog>
  </>;
}
