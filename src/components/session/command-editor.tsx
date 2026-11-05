import { useId, useState } from 'react';
import { useApp } from '@/state/app-context';
import { commandError, editDemoCommand } from '@/state/session-actions';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
import './demo-actions.css';

export function CommandEditor({sessionId,index,command,onClose}:{sessionId:string;index:number;command:string;onClose:()=>void}) {
  const {m,update}=useApp();const [original]=useState(command);const [draft,setDraft]=useState(command),[error,setError]=useState('');const id=useId();
  const current=m.threads[sessionId]?.[index];const valid=current?.card==='approval'&&current.cmd===original&&m.sessions.some(s=>s.id===sessionId&&!s.runId&&s.st!=='paused');
  const problem=commandError(draft);
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="demo-action-dialog">
    <DialogTitle>Review demo command</DialogTitle>
    <DialogDescription>Edit this pending sample command, then save and review it on the approval card. Saving does not approve or execute it. Live Codex uses a fixed non-interactive approval policy and cannot use this editor.</DialogDescription>
    <label htmlFor={id}>Pending command</label><textarea id={id} value={draft} maxLength={2001} aria-invalid={!!problem} aria-describedby={`${id}-help`} onChange={e=>{setDraft(e.target.value);setError('');}}/>
    <p id={`${id}-help`}>One line, up to 2,000 characters. This editor stores demo text only.</p>
    {(problem||!valid||error)&&<p role="alert">{!valid?'This request changed or is no longer editable. Close and review the current session.':problem??error}</p>}
    <div className="btns"><Button onClick={onClose}>Cancel</Button><Button variant="primary" disabled={!!problem||!valid} onClick={()=>{if(!valid){setError('This request changed. Reopen it to review.');return;}update(d=>{editDemoCommand(d,sessionId,index,original,draft);});onClose();}}>Save demo command</Button></div>
  </DialogContent></Dialog>;
}
