import { useEffect, useState } from 'react';
import type { WorktreeState } from '../../../shared/worktrees';
import { useApp } from '@/state/app-context';
import { useMemory } from '@/state/memory-context';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
export function WorktreeSettings(){
  const {refreshAgent,notify}=useApp();
  const {refresh:refreshMemory}=useMemory();
  const [state,setState]=useState<WorktreeState|null>(null);
  const [location,setLocation]=useState('');
  const [removeMerged,setRemoveMerged]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  useEffect(()=>{if(!window.theseus)return;const unsubscribe=window.theseus.onWorktreeState(setState);void window.theseus.getWorktreeState().then(value=>{setState(value);setLocation(value.preferences.location);setRemoveMerged(value.preferences.removeMerged);}).catch(e=>setError(String(e)));return unsubscribe;},[]);
  async function act(action:()=>Promise<void>){setBusy(true);setError('');setMessage('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Worktree operation failed.');}finally{setBusy(false);}}
  if(!window.theseus)return <p className="demo-note">Worktree storage and cleanup are available in the desktop app.</p>;
  return <div className="worktree-settings mt-3">
    <label htmlFor="worktree-location">Storage folder</label>
    <div className="worktree-location mt-3"><input id="worktree-location" className="min-w-0 flex-1" value={location} disabled={busy||!state} onChange={e=>setLocation(e.target.value)} placeholder="Absolute folder path"/><Button size="sm" disabled={busy||!state} onClick={()=>void act(async()=>{const value=await window.theseus!.saveWorktreePreferences({location,removeMerged});setState(value);setLocation(value.preferences.location);setMessage('Worktree preferences saved. Existing worktrees keep their locations.');})}>Save preferences</Button></div>
    <label className="flex items-center gap-3 mt-3"><Switch aria-label="Remove merged worktrees" checked={removeMerged} disabled={busy||!state} onCheckedChange={setRemoveMerged}/>Remove merged worktrees automatically</label>
    <p className="demo-note mt-3">Save preferences applies to both controls. Automatic cleanup checks every minute. Only Theseus-owned worktrees merged into their original branch are eligible. Active tasks, the selected folder, terminal commands, and folders with local or ignored files are kept. Branches are retained.</p>
    <Button size="sm" disabled={busy||!state} onClick={()=>void act(async()=>{const result=await window.theseus!.cleanupWorktrees();setState(await window.theseus!.getWorktreeState());setMessage(`${result.removed.length} removed · ${result.skipped.length} kept.`);if(result.errors.length)setError(result.errors.join('\n'));})}>{busy?'Working…':'Clean up merged worktrees'}</Button>
    {state?.worktrees.filter(w=>w.state!=='removed').map(w=><div className="mt-3" key={w.id}><span className="worktree-path mono" title={w.path}>{w.path}</span><p className="demo-note">{w.branch} · {w.state==='creating'?(w.recovery?.message??'Checking interrupted creation…'):'Ready'}</p><Button size="sm" disabled={busy||w.state!=='ready'} onClick={()=>void act(async()=>{await window.theseus!.selectManagedWorktree(w.id);await refreshAgent();await refreshMemory();notify('Worktree selected as the project folder.');setMessage(`Selected ${w.path}`);})}>Select worktree</Button>{w.state==='creating'&&w.recovery?.status!=='manual'&&w.recovery&&<Button className="ml-2" size="sm" disabled={busy} onClick={()=>void act(async()=>{const action=w.recovery!.status==='recoverable'?'recover':'forget';setState(await window.theseus!.recoverWorktree(w.id,action));setMessage(action==='recover'?'Worktree recovered. All files and branches were kept.':'Creation record forgotten. No files or branches were removed.');})}>{w.recovery.status==='recoverable'?'Recover worktree':'Forget creation record'}</Button>}</div>)}
    {message&&<p role="status" className="mt-3">{message}</p>}{(error||state?.warning)&&<p role="alert" className="run-error mt-3 whitespace-pre-wrap">{error||state?.warning}</p>}
  </div>;
}
