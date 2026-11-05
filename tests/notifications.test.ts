import { describe, expect, it } from 'vitest';
import type { AgentRun } from '../shared/bridge';
import { allowsNotification, desktopDefaults, isDeepWork } from '../shared/desktop';
import { notificationCandidates, receiveNotifications } from '../src/state/notifications';
import { editDemoCommand } from '../src/state/session-actions';
import { createModel } from '../src/state/model';

const morning=new Date(2026,9,23,10),evening=new Date(2026,9,23,18);
const run=(id:string,status:AgentRun['status'],endedAt='2026-10-23T18:00:00.000Z'):AgentRun=>({
  id,status,startedAt:'2026-10-23T17:00:00.000Z',endedAt,task:id,projectName:'Project',
} as AgentRun);
const candidates=(...runs:AgentRun[])=>notificationCandidates(Object.fromEntries(runs.map(r=>[r.id,r])),[]);

describe('notification feed delivery',()=>{
  it('applies category toggles before delivery, without suppressing uncategorized outcomes',()=>{
    const items=candidates(run('done','completed'),run('fail','failed'),run('cancel','cancelled'),run('interrupt','interrupted'),run('active','running'));
    const decisions=receiveNotifications(new Map(),items,desktopDefaults,evening);
    expect(items.filter(item=>decisions.get(item.id)).map(item=>item.session)).toEqual(['fail','cancel','interrupt']);
    const off=receiveNotifications(new Map(),items,{...desktopDefaults,nFail:false,nDone:true},evening);
    expect(items.filter(item=>off.get(item.id)).map(item=>item.session)).toEqual(['done','cancel','interrupt']);
  });

  it('uses updated preferences for new events and never replays suppressed deliveries',()=>{
    const initial=candidates(run('old-completed','completed'),run('old-failed','failed'));
    const before=receiveNotifications(new Map(),initial,desktopDefaults,evening);
    const read=new Set(initial.filter(item=>before.get(item.id)).map(item=>item.id));
    const all=[...initial,...candidates(run('new-completed','completed'),run('new-failed','failed'))];
    const preferences={...desktopDefaults,nDone:true,nFail:false};
    const after=receiveNotifications(before,all,preferences,evening);
    expect(all.filter(item=>after.get(item.id)).map(item=>item.session)).toEqual(['old-failed','new-completed']);
    expect(all.filter(item=>after.get(item.id)&&!read.has(item.id)).map(item=>item.session)).toEqual(['new-completed']);
    expect(receiveNotifications(after,all,desktopDefaults,evening)).toBe(after);
  });

  it('suppresses new deep-work items and keeps suppression after the window ends',()=>{
    const items=candidates(run('done','completed'),run('fail','failed'),run('cancel','cancelled'),run('interrupt','interrupted'));
    const preferences={...desktopDefaults,nDone:true,deepOn:true};
    const blockers=receiveNotifications(new Map(),items,preferences,morning);
    expect(items.filter(item=>blockers.get(item.id)).map(item=>item.session)).toEqual(['fail','interrupt']);
    const nothing=receiveNotifications(new Map(),items,{...preferences,deep:'nothing'},morning);
    expect([...nothing.values()]).toEqual([false,false,false,false]);
    expect(receiveNotifications(nothing,items,preferences,evening)).toBe(nothing);
    expect(allowsNotification({...preferences,nFail:false},'failure',true,morning)).toBe(false);
  });

  it('refreshes an edited approval detail without replaying its delivered notification',()=>{
    const m=createModel(),before=notificationCandidates(m.runs,m.sessions,m.threads);
    const decisions=receiveNotifications(new Map(),before,desktopDefaults,evening);
    const index=m.threads.c1.findIndex(x=>x.card==='approval');
    editDemoCommand(m,'c1',index,m.threads.c1[index].cmd!,'pnpm test --filter reviewed-command');
    const after=notificationCandidates(m.runs,m.sessions,m.threads);
    expect(after.find(item=>item.session==='c1')?.detail).toBe('pnpm test --filter reviewed-command');
    expect(after.map(item=>item.id)).toEqual(before.map(item=>item.id));
    expect(receiveNotifications(decisions,after,desktopDefaults,evening)).toBe(decisions);
  });

  it('defines sample errors and attention blockers without duplicating live sessions',()=>{
    const model=createModel();
    const items=notificationCandidates({},[...model.sessions,{...model.sessions[0],id:'live',runId:'live'}]);
    expect(items).toHaveLength(4);
    const defaults=receiveNotifications(new Map(),items,desktopDefaults,evening);
    expect([...defaults.values()].every(Boolean)).toBe(true);
    const preferences={...desktopDefaults,nFail:false,deepOn:true};
    const decisions=receiveNotifications(new Map(),items,preferences,morning);
    expect(items.filter(item=>decisions.get(item.id)).map(item=>item.title).sort()).toEqual(['Needs approval','Needs your pick']);
  });

  it('distinguishes subsequent completions of a continued run and ignores ordinary result updates',()=>{
    const first=candidates(run('same','completed'));
    const before=receiveNotifications(new Map(),first,{...desktopDefaults,nDone:true},evening);
    const refreshed=candidates({...run('same','completed'),task:'Updated text'});
    expect(receiveNotifications(before,refreshed,desktopDefaults,evening)).toBe(before);
    const second=candidates(run('same','completed','2026-10-23T19:00:00.000Z'));
    expect(second[0].id).not.toBe(first[0].id);
    const after=receiveNotifications(before,second,desktopDefaults,evening);
    expect(after.get(second[0].id)).toBe(false);
  });

  it('does not apply system delivery styles to the feed',()=>{
    const items=candidates(run('fail','failed'));
    for(const deliver of ['banner','sound','badge'] as const){
      expect(receiveNotifications(new Map(),items,{...desktopDefaults,deliver},evening).get(items[0].id)).toBe(true);
    }
  });
});

it('uses local weekday deep-work boundaries',()=>{
  const preferences={...desktopDefaults,deepOn:true};
  for(const [date,expected] of [
    [new Date(2026,9,23,8,59),false],[new Date(2026,9,23,9),true],
    [new Date(2026,9,23,11,59),true],[new Date(2026,9,23,12),false],
    [new Date(2026,9,24,10),false],[new Date(2026,9,25,10),false],[new Date(2026,9,26,10),true],
  ] as const)expect(isDeepWork(preferences,date)).toBe(expected);
  expect(isDeepWork(desktopDefaults,morning)).toBe(false);
});
