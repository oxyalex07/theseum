import { describe, expect, it, vi } from 'vitest';
import { finalRunStatus, parseCodexEvent, redact, validateStartRun } from '../electron/codex-protocol';
import { codexArguments } from '../electron/agent-runner';
import { applyAgentRun, createModel } from '../src/state/model';
import type { AgentRun } from '../shared/bridge';
describe('Codex execution boundary',()=>{
  it('keeps hostile task strings as data with fixed arguments and a stdin sentinel',()=>{
    const task='$(touch /tmp/never); `echo secret`\n--dangerously-bypass-approvals-and-sandbox';
    expect(validateStartRun({workspaceId:'11111111-1111-4111-8111-111111111111',task}).task).toBe(task);
    expect(codexArguments.at(-1)).toBe('-');expect(codexArguments).not.toContain(task);
    expect(codexArguments).toContain('workspace-write');expect(codexArguments).not.toContain('--dangerously-bypass-approvals-and-sandbox');
    for(const input of [null,{workspaceId:'/tmp/project',task:'run'},{workspaceId:'11111111-1111-4111-8111-111111111111',task:'\0'}, {workspaceId:'11111111-1111-4111-8111-111111111111',task:'x'.repeat(32001)}])expect(()=>validateStartRun(input)).toThrow();
  });
  it('requires both process success and a completed turn, and treats cancellation explicitly',()=>{
    expect(finalRunStatus(false,0,true)).toBe('completed');
    expect(finalRunStatus(false,1,true)).toBe('failed');
    expect(finalRunStatus(false,0,false)).toBe('failed');
    expect(finalRunStatus(false,0,true,'provider error')).toBe('failed');
    expect(finalRunStatus(true,0,true)).toBe('cancelled');
    expect(finalRunStatus(false,null,true)).toBe('failed');
  });
  it('whitelists public event fields rather than forwarding raw JSON or credential events',()=>{
    expect(parseCodexEvent('{bad json')).toEqual({});
    expect(parseCodexEvent(JSON.stringify({type:'auth',token:'private'}))).toEqual({});
    expect(parseCodexEvent(JSON.stringify({type:'item.completed',item:{type:'reasoning',text:'private'}}))).toEqual({});
    expect(parseCodexEvent(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Hello',secret:'not forwarded'}}))).toEqual({output:{kind:'message',text:'Hello'}});
    expect(parseCodexEvent('{"type":"turn.failed","error":{"message":"rate limit"}}').failed).toBe('rate limit');
    expect(parseCodexEvent('{"type":"turn.completed"}').completed).toBe(true);
  });
  it('redacts environment secrets and common token formats',()=>{
    vi.stubEnv('TEST_API_KEY','sensitive-environment-value');
    expect(redact('sensitive-environment-value Bearer a-secret-token sk-abcdefghijklmnop')).not.toMatch(/sensitive-environment-value|a-secret-token|sk-abcdefghijklmnop/);
    vi.unstubAllEnvs();
  });
  it('does not let late start IPC responses overwrite newer run events',()=>{
    const m=createModel();const run:AgentRun={id:'r',revision:4,workspaceId:'w',projectName:'Project',projectPath:'/tmp/project',task:'task',status:'completed',startedAt:'now',output:[],truncated:false};
    applyAgentRun(m,run);applyAgentRun(m,{...run,revision:1,status:'running'});
    expect(m.runs.r.status).toBe('completed');expect(m.sessions[0].st).toBe('completed');expect(m.sessions[0].runId).toBe('r');
    expect(m.threads.r).toBeUndefined();
  });
});

it('accepts only explicit UUID thread identifiers from thread.started',()=>{
  const threadId='33333333-3333-4333-8333-333333333333';
  expect(parseCodexEvent(JSON.stringify({type:'thread.started',thread_id:threadId})).threadId).toBe(threadId);
  for(const thread_id of ['--last','named-thread','x'.repeat(36),null])expect(parseCodexEvent(JSON.stringify({type:'thread.started',thread_id})).threadId).toBeUndefined();
});
