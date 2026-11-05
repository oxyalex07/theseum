import { describe, expect, it } from 'vitest';
import { createModel, resolveSession } from '../src/state/model';
import { appendDemoReply, commandError, demoTranscript, editDemoCommand, forkDemoSession, pauseDemoSession, resumeDemoSession, sessionPreview } from '../src/state/session-actions';

describe('demo session actions',()=>{
  it('forks an independent project/context snapshot without live or Git ownership',()=>{
    const m=createModel();m.drafts.c1='unsent';
    const source=m.sessions.find(s=>s.id==='c1')!;source.runId=undefined;
    const fork=forkDemoSession(m,'c1','fork')!;
    expect(fork.pj).toBe(source.pj);expect(fork.br).toBe(source.br);expect(fork.runId).toBeUndefined();expect(fork.prn).toBeUndefined();
    expect(fork.forkSource).toMatchObject({sessionId:'c1',title:source.t,messageCount:m.threads.c1.length});expect(fork.st).toBe('waiting');
    expect(m.drafts.fork).toBe('');expect(m.drafts.c1).toBe('unsent');
    const index=m.threads.fork.findIndex(x=>x.card==='approval');
    editDemoCommand(m,'fork',index,m.threads.fork[index].cmd!,'pnpm test');resolveSession(m,'fork','approve');
    expect(m.threads.c1[index].cmd).toBe('pnpm add recharts@2.12.7');expect(source.st).toBe('waiting');
    expect(m.runs).toEqual({});
  });
  it('records a displayed commit as reference and copies only through its error card',()=>{
    const m=createModel(),index=m.threads.c3.findIndex(x=>x.card==='error');
    m.threads.c3.push({r:'you',t:'later context',plain:true});
    const fork=forkDemoSession(m,'c3','fork',index,'a41c9e2')!;
    expect(fork.forkSource?.commit).toBe('a41c9e2');expect(m.threads.fork).toHaveLength(index+1);expect(m.threads.fork.some(x=>x.t==='later context')).toBe(false);
    expect(forkDemoSession(m,'c3','invalid',index,'wrong')).toBeUndefined();
    expect(forkDemoSession(m,'c3','invalid',999)).toBeUndefined();expect(forkDemoSession(m,'c3','fork')).toBeUndefined();
    expect(demoTranscript(fork,m.threads.fork)).toContain('commit reference: a41c9e2 (no checkout)');
  });
  it('edits only a current pending request and remembers the exact edited demo command',()=>{
    const m=createModel(),index=m.threads.c1.findIndex(x=>x.card==='approval'),original=m.threads.c1[index].cmd!;
    expect(editDemoCommand(m,'c1',index,original,'  pnpm test  ')).toBe(true);
    expect(m.threads.c1[index]).toMatchObject({cmd:'pnpm test'});expect(m.threads.c1[index].aff).toBeUndefined();expect(m.threads.c1[index].risk).toBeUndefined();
    expect(editDemoCommand(m,'c1',index,original,'stale command')).toBe(false);
    resolveSession(m,'c1','always');expect(m.settings.allow).toContain('pnpm test');expect(m.memory.code.xs).toContainEqual({t:'Demo approval: pnpm test',nw:1});
    expect(m.sessions.find(s=>s.id==='c1')?.prev[1]).toBe('pnpm test');expect(editDemoCommand(m,'c1',index,'pnpm test','too late')).toBe(false);
  });
  it('derives approval previews from the request that will actually resolve',()=>{
    const m=createModel(),s=m.sessions.find(s=>s.id==='c1')!,index=m.threads.c1.findIndex(x=>x.card==='approval');
    editDemoCommand(m,s.id,index,m.threads.c1[index].cmd!,'pnpm test --filter reviewed-command');
    expect(sessionPreview(s,m.threads.c1)).toEqual(['BASH','pnpm test --filter reviewed-command']);
    const fork=forkDemoSession(m,s.id,'fork')!;
    expect(sessionPreview(fork,m.threads.fork)).toEqual(['BASH','pnpm test --filter reviewed-command']);
    resolveSession(m,s.id,'approve');expect(sessionPreview(s,m.threads.c1)).toEqual(s.prev);
    expect(sessionPreview({...fork,runId:'live'},m.threads.fork)).toEqual(fork.prev);
  });
  it('rejects empty, multiline, control or oversized demo commands',()=>{
    for(const command of ['', '  ', 'a\nb','a\rb','a\0b','a\tb','x'.repeat(2001)])expect(commandError(command)).toBeTruthy();
    expect(commandError('pnpm test -- --run')).toBeUndefined();
  });
  it('pauses demo activity, buffers scheduled replies and resumes exactly once',()=>{
    const m=createModel(),s=m.sessions.find(s=>s.id==='r1')!,status=s.st,prev=[...s.prev],count=m.threads.r1.length;
    pauseDemoSession(m,'r1');pauseDemoSession(m,'r1');expect(s.st).toBe('paused');
    appendDemoReply(m,'r1',{r:'ag',t:'queued reply'});expect(m.threads.r1).toHaveLength(count);
    resumeDemoSession(m,'r1');expect(s.st).toBe(status);expect(s.prev).toEqual(prev);expect(m.threads.r1.at(-1)?.t).toBe('queued reply');
    resumeDemoSession(m,'r1');expect(m.threads.r1).toHaveLength(count+1);expect(m.demoPending.r1).toBeUndefined();
    pauseDemoSession(m,'r1');appendDemoReply(m,'r1',{t:'startup'},true);expect(s.st).toBe('paused');resumeDemoSession(m,'r1');expect(s.st).toBe('running');
  });
  it('never applies demo actions to live sessions or resolves the wrong request kind',()=>{
    const m=createModel();m.sessions.find(s=>s.id==='c1')!.runId='real';const before=structuredClone(m);
    pauseDemoSession(m,'c1');resumeDemoSession(m,'c1');appendDemoReply(m,'c1',{t:'fake'});resolveSession(m,'c1','approve');
    expect(editDemoCommand(m,'c1',m.threads.c1.findIndex(x=>x.card==='approval'),'pnpm add recharts@2.12.7','anything')).toBe(false);
    expect(forkDemoSession(m,'c1','fake')).toBeUndefined();expect(m).toEqual(before);
    resolveSession(m,'c3','approve');expect(m.threads.c3.some(x=>x.card==='error')).toBe(true);
  });
});
