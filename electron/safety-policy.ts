import { readFileSync, mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { defaultSafetyPolicy, executionCapabilities, validateSafetyPolicy, type SafetyPolicy, type SafetyState } from '../shared/safety';

/** Main owns durable policy. An unreadable policy never falls back to broader defaults. */
export class SafetyPolicies {
  private policy = defaultSafetyPolicy();
  private error?: string;
  constructor(private directory: string) {
    try {
      const envelope = JSON.parse(readFileSync(join(directory,'safety-policy.json'),'utf8'));
      if (envelope.version !== 1) throw new Error('Unsupported policy version');
      this.policy = validateSafetyPolicy(envelope.policy);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.error = 'Safety policy could not be read. Live tasks are disabled. Repair safety-policy.json in app user data and restart.';
    }
  }
  state(): SafetyState { return {capabilities:executionCapabilities,policy:structuredClone(this.policy),...(this.error?{error:this.error}:{})}; }
  current(): SafetyPolicy { if (this.error) throw new Error(this.error); return structuredClone(this.policy); }
  save(input: unknown): SafetyState {
    this.current();
    const policy = validateSafetyPolicy(input), target = join(this.directory,'safety-policy.json'), temporary = target+'.tmp';
    try {
      mkdirSync(this.directory,{recursive:true,mode:0o700});
      const fd = openSync(temporary,'w',0o600);
      try { writeFileSync(fd,JSON.stringify({version:1,policy}),'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temporary,target);
    } catch { throw new Error('Safety policy could not be saved. Check disk space and app user-data permissions.'); }
    finally { try { unlinkSync(temporary); } catch { /* committed or absent */ } }
    this.policy = policy; return this.state();
  }
}
