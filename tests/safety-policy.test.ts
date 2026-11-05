import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultSafetyPolicy, validateSafetyPolicy } from '../shared/safety';
import { SafetyPolicies } from '../electron/safety-policy';
import { argumentsForProfile } from '../electron/agent-runner';
import { storedRun } from '../electron/run-history';
import type { AgentSnapshot } from '../shared/bridge';

describe('main-owned safety policy',()=>{
  it('rejects unsupported permissions rather than dropping them',()=>{
    for(const change of [{approval:'on-request'},{askFirst:true},{network:'on'},{network:'list'},{commandAllowlist:['pnpm build']},{stepTimeout:60},{timeoutSeconds:0},{timeoutSeconds:1801}]){
      expect(()=>validateSafetyPolicy({...defaultSafetyPolicy(),...change})).toThrow();
    }
  });
  it('persists validated policies across restart and keeps last policy on invalid writes',()=>{
    const directory=mkdtempSync(join(tmpdir(),'theseus-safety-'));
    try{
      const store=new SafetyPolicies(directory);
      store.save({...defaultSafetyPolicy(),timeoutSeconds:60});
      expect(new SafetyPolicies(directory).current().timeoutSeconds).toBe(60);
      expect(()=>store.save({...defaultSafetyPolicy(),network:'on'})).toThrow();
      expect(store.current().timeoutSeconds).toBe(60);
      expect(JSON.parse(readFileSync(join(directory,'safety-policy.json'),'utf8')).policy.timeoutSeconds).toBe(60);
      writeFileSync(join(directory,'safety-policy.json'),'{broken');
      const damaged=new SafetyPolicies(directory);
      expect(damaged.state().error).toContain('disabled');
      expect(()=>damaged.current()).toThrow();
      expect(()=>damaged.save(defaultSafetyPolicy())).toThrow();
    }finally{rmSync(directory,{recursive:true,force:true});}
  });
  it('pins runtime permissions and preserves the policy used in history',()=>{
    const configuration:AgentSnapshot={runtimeDefaults:true,approvalPolicy:'never',timeoutSeconds:60,safetyPolicy:{...defaultSafetyPolicy(),timeoutSeconds:60}};
    const args=argumentsForProfile(configuration);
    expect(args).toContain('sandbox_workspace_write.network_access=false');
    expect(args).toContain('web_search="disabled"');
    expect(args).toContain('--ignore-rules');
    expect(args[args.indexOf('--ask-for-approval')+1]).toBe('never');
    expect(()=>argumentsForProfile({...configuration,safetyPolicy:{...configuration.safetyPolicy!,askFirst:true} as any})).toThrow();
    const id='11111111-1111-4111-8111-111111111111';
    const run=storedRun({id,workspaceId:id,revision:1,projectName:'p',projectPath:'/p',task:'t',status:'completed',startedAt:new Date().toISOString(),output:[],truncated:false,agentConfiguration:configuration});
    expect(run.agentConfiguration?.safetyPolicy).toEqual(configuration.safetyPolicy);
  });
});
