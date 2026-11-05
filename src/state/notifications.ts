import type { AgentRun } from '../../shared/bridge';
import { allowsNotification, type DesktopPreferences } from '../../shared/desktop';
import { NEEDY, statusLabels, type Message, type Session } from '../types';
import { sessionPreview } from './session-actions';

export interface NotificationItem {
  id:string;session:string;title:string;body:string;detail:string;icon:string;sample:boolean;time:string;
  category:'failure'|'completion'|'attention';blocker:boolean;
}
export function notificationCandidates(runs:Record<string,AgentRun>,sessions:Session[],threads:Record<string,Message[]> = {}):NotificationItem[]{
  return [
    ...Object.values(runs).filter(run=>['completed','failed','cancelled','interrupted'].includes(run.status))
      .sort((a,b)=>(b.endedAt??b.startedAt).localeCompare(a.endedAt??a.startedAt))
      .map((run):NotificationItem=>({
        // A continued run can finish again with the same ID and status.
        id:`${run.id}:${run.status}:${run.startedAt}:${run.endedAt??''}`,session:run.id,
        title:statusLabels[run.status],body:run.task,detail:run.error??run.projectName,
        icon:run.status==='completed'?'check':'alert',sample:false,time:run.endedAt??run.startedAt,
        category:run.status==='failed'?'failure':run.status==='completed'?'completion':'attention',
        blocker:['failed','interrupted'].includes(run.status),
      })),
    ...sessions.filter(s=>!s.runId&&NEEDY.includes(s.st)).map((s):NotificationItem=>({
      id:`demo:${s.id}:${s.st}`,session:s.id,title:statusLabels[s.st],body:s.t,detail:sessionPreview(s,threads[s.id])[1],
      icon:s.st==='error'?'alert':s.st==='review'?'eye':'msg',sample:true,time:'',
      category:s.st==='error'?'failure':'attention',blocker:s.st!=='review',
    })),
  ];
}

// Remember both allowed and suppressed deliveries. Changing preferences or leaving
// deep work must not replay a suppressed event or remove a delivered/read item.
export function receiveNotifications(decisions:ReadonlyMap<string,boolean>,candidates:NotificationItem[],preferences:DesktopPreferences,now:Date):ReadonlyMap<string,boolean>{
  const incoming=candidates.filter(item=>!decisions.has(item.id));
  if(!incoming.length)return decisions;
  const next=new Map(decisions);
  for(const item of incoming)next.set(item.id,allowsNotification(preferences,item.category,item.blocker,now));
  return next;
}
