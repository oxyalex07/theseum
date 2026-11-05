import { expect, it } from 'vitest';
import { crewPlan, validateCrew, executionSandbox } from '../shared/crew';
import { validateStartRun } from '../electron/codex-protocol';
import { storedRun, historyDeletionCandidates } from '../electron/run-history';
import type { AgentRun } from '../shared/bridge';
const id='11111111-1111-4111-8111-111111111111';
it('previews the same explicit and automatic routes used by main',()=>{
  expect(crewPlan('auto','Implement a feature')).toEqual(['forge','sentinel']);
  expect(crewPlan('auto','Research the options')).toEqual(['scout','quill']);
  expect(crewPlan('auto','Review the changes')).toEqual(['sentinel']);
  expect(crewPlan('quill','Review the changes')).toEqual(['quill']);
});
it('validates crew IPC options and rejects ambiguous or injected execution configuration',()=>{
  const crew={route:'feature',profiles:{forge:{id,updatedAt:'2026-10-26T00:00:00Z'}}};
  expect(validateCrew(crew)).toEqual(crew);
  expect(validateStartRun({workspaceId:id,task:'Build',crew}).crew).toEqual(crew);
  for(const invalid of [{route:'unknown'},{route:'feature',profiles:{forge:{id,updatedAt:'bad'}}},{route:'feature',profiles:{unknown:{id,updatedAt:'2026-10-26'}}},{route:'feature',shell:'unsafe'}])expect(()=>validateCrew(invalid)).toThrow();
  expect(()=>validateStartRun({workspaceId:id,task:'Build',crew,profileId:id})).toThrow('role profiles');
});
it('persists crew ownership and dependencies and protects predecessor history while work is active',()=>{
  const first:AgentRun={id,workspaceId:id,revision:1,projectName:'Project',projectPath:'/project',task:'Build',status:'completed',startedAt:'2026-10-26T00:00:00Z',output:[],truncated:false,crew:{id,role:'forge',dependsOn:[]}};
  const second:AgentRun={...first,id:'22222222-2222-4222-8222-222222222222',status:'queued',crew:{id,role:'sentinel',dependsOn:[first.id]}};
  expect(storedRun(second)).toEqual(second);
  expect(historyDeletionCandidates([first,second],{all:true})).toEqual([]);
  expect(()=>historyDeletionCandidates([first,second],{ids:[first.id]})).toThrow('crew history');
  expect(historyDeletionCandidates([first,{...second,status:'completed'}],{all:true})).toHaveLength(2);
  expect(executionSandbox(second)).toBe('read-only');
  expect(()=>storedRun({...second,crew:{...second.crew,dependsOn:[second.id]}})).toThrow();
});
