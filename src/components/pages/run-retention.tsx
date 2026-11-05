import { useState } from 'react';
import { useApp } from '@/state/app-context';
import type { RunRetention } from '../../../shared/bridge';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog';
export function RunRetentionControl(){
  const {retention,setRetention}=useApp();
  const [pending,setPending]=useState<RunRetention|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(){if(!pending)return;setBusy(true);setError('');try{await setRetention(pending);setPending(null);}catch(e){setError(e instanceof Error?e.message:'Could not save retention. Try again.');}finally{setBusy(false);}}
  return <><select aria-label="Keep run history" disabled={!window.theseus||busy} value={retention} onChange={e=>{setError('');setPending(e.target.value as RunRetention);}}>{[['30','30 days'],['90','90 days'],['365','1 year'],['all','Forever']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <Dialog open={pending!==null} onOpenChange={open=>{if(!busy&&!open)setPending(null);}}><DialogContent><DialogTitle>Change run retention?</DialogTitle><DialogDescription>{pending==='all'?'Keep saved runs until you delete them. Previously deleted history cannot be restored.':`Permanently delete finished runs older than ${pending} days, measured from their end time (or start time for older records). This applies now, on startup, and every minute. Active runs are kept.`} Memories and their saved source excerpts are kept separately.</DialogDescription>{error&&<p className="run-error" role="alert">{error}</p>}<div className="btns"><Button disabled={busy} onClick={()=>setPending(null)}>Cancel</Button><Button disabled={busy} variant={pending==='all'?'primary':'destructive'} onClick={()=>void save()}>{busy?'Saving…':'Apply retention'}</Button></div></DialogContent></Dialog>
  </>;
}
