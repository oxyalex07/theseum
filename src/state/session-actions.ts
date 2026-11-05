import type { Model } from './model';
import type { Message, Session } from '../types';

// Match the first pending approval that resolveSession will consume.
export function sessionPreview(session: Session, messages: Message[] = []): [string, string] {
  const command=!session.runId && session.st==='waiting' ? messages.find(m=>m.card==='approval')?.cmd : undefined;
  return command ? ['BASH',command] : session.prev;
}

export function commandError(command: string): string | undefined {
  if (!command.trim()) return 'Enter a command.';
  if (command.length > 2000) return 'Use at most 2,000 characters.';
  if (/[\x00-\x1f\x7f]/.test(command)) return 'Use a single line without control characters.';
}

export function editDemoCommand(m: Model, id: string, index: number, expected: string, command: string) {
  const session=m.sessions.find(s=>s.id===id), card=m.threads[id]?.[index];
  if (!session || session.runId || session.st==='paused' || card?.card!=='approval' || card.cmd!==expected || commandError(command)) return false;
  card.cmd=command.trim();
  // Fixture claims about package counts/risk no longer describe an edited command.
  card.why='Edited by you for this demo approval. Review the command before approving.';
  delete card.aff; delete card.risk;
  return true;
}

export function pauseDemoSession(m: Model, id: string) {
  const s=m.sessions.find(s=>s.id===id);
  if (!s || s.runId || (s.st!=='running' && s.st!=='thinking')) return;
  s.demoResume={status:s.st,prev:[...s.prev]};s.st='paused';s.prev=['','demo activity paused by you'];
}

export function resumeDemoSession(m: Model, id: string) {
  const s=m.sessions.find(s=>s.id===id);
  if (!s || s.runId || s.st!=='paused' || !s.demoResume) return;
  s.st=s.demoResume.status;s.prev=s.demoResume.prev;delete s.demoResume;
  (m.threads[id]??=[]).push(...(m.demoPending[id]??[]));delete m.demoPending[id];
}

export function appendDemoReply(m: Model, id: string, message: Message, started=false) {
  const s=m.sessions.find(s=>s.id===id);if (!s || s.runId) return;
  if (s.st==='paused') {
    (m.demoPending[id]??=[]).push(message);
    if(started && s.demoResume)s.demoResume.status='running';
  } else {
    (m.threads[id]??=[]).push(message);if(started)s.st='running';
  }
}

export function forkDemoSession(m: Model, sourceId: string, id: string, through?: number, commit?: string): Session | undefined {
  const source=m.sessions.find(s=>s.id===sourceId), thread=m.threads[sourceId];
  if (!source || source.runId || !thread || m.sessions.some(s=>s.id===id)) return;
  const end=through??thread.length-1;
  if (!Number.isInteger(end)||end<0||end>=thread.length || (commit && (thread[end].card!=='error'||thread[end].commit!==commit)))return;
  const copied=structuredClone(thread.slice(0,end+1));
  const pending=[...copied].reverse().find(x=>x.card==='approval'||x.card==='error'||(x.card==='options'&&x.pick===undefined));
  const fork:Session={id,ag:source.ag,pj:source.pj,t:`Fork · ${source.t}`,br:source.br,time:'now',st:pending?.card==='approval'?'waiting':pending?.card==='error'?'error':pending?.card==='options'?'question':'done',prev:['','demo conversation fork'],
    forkSource:{sessionId:source.id,title:source.t,projectId:source.pj,branch:source.br,commit,messageCount:copied.length}};
  m.sessions.unshift(fork);m.threads[id]=copied;m.drafts[id]='';return fork;
}

export function demoTranscript(session: Session, messages: Message[]) {
  return [`Demo · ${session.t}`,`Project: ${session.pj}${session.br?` · branch label: ${session.br}`:''}`,
    ...(session.forkSource?[`Fork source: ${session.forkSource.title} (${session.forkSource.sessionId}); ${session.forkSource.messageCount} messages${session.forkSource.commit?`; commit reference: ${session.forkSource.commit} (no checkout)`:''}`]:[]),
    ...messages.map(m=>m.sys??(m.mem?`Demo preferences: ${m.mem.join(', ')}`:`${m.r==='you'?'You':'Demo agent'}: ${[m.t,m.card,m.cmd,m.why,m.log,m.note,...(m.tools??[]).map(t=>`${t.tag}: ${t.title}\n${t.out??''}`),...(m.items??[]).map(x=>x.join(' · ')),...(m.opts??[]).map(x=>x[0])].filter(Boolean).join('\n')}`))].join('\n\n');
}
