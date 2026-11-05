import { mkdirSync, readFileSync, writeFileSync, openSync, closeSync, fsyncSync, renameSync, readdirSync, unlinkSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AgentConfiguration, AgentProfile, AgentProfileLifecycleRequest, AgentRun, RuntimeCheck, SaveAgentRequest } from '../shared/bridge';
import { isActiveRun } from '../shared/bridge';
import { redact } from './codex-protocol';
import { githubSource } from './github-agents';
export const validId=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
const text=(value:unknown,name:string,max:number)=>{if(typeof value!=='string'||value.length>max||value.includes('\0'))throw new Error(`${name} must be text of at most ${max} characters.`);return redact(value.trim());};
export function validateConfiguration(input:unknown):AgentConfiguration {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid agent configuration.');
  const r=input as AgentConfiguration;
  const name=text(r.name,'Name',80);if(!name)throw new Error('Give your agent a name.');
  if(!['code','spark','shield','bug','book'].includes(r.icon)||!['violet','green','blue','amber','pink'].includes(r.color))throw new Error('Choose a supported icon and color.');
  if(r.runtime!=='codex')throw new Error('Only Codex is currently implemented.');
  if(!['none','project','personal-project'].includes(r.memory))throw new Error('Choose a supported memory policy.');
  if(!['read-only','workspace-write'].includes(r.sandbox))throw new Error('Choose read-only or workspace-write permissions.');
  if(!Number.isInteger(r.timeoutSeconds)||r.timeoutSeconds<5||r.timeoutSeconds>1800)throw new Error('Time limit must be between 5 and 1,800 seconds.');
  const model=r.model===null?null:text(r.model,'Model',120),reasoningEffort=r.reasoningEffort===null?null:text(r.reasoningEffort,'Reasoning effort',40);
  if(model!==null&&!/^[a-zA-Z0-9._:/-]+$/.test(model)||reasoningEffort!==null&&!/^[a-zA-Z0-9_-]+$/.test(reasoningEffort))throw new Error('Invalid model or reasoning effort.');
  if(reasoningEffort&&!model)throw new Error('Select an advertised model before overriding reasoning effort.');
  return {name,icon:r.icon,color:r.color,description:text(r.description,'Description',500),runtime:'codex',model,reasoningEffort,instructions:text(r.instructions,'Instructions',32000),memory:r.memory,sandbox:r.sandbox,timeoutSeconds:r.timeoutSeconds,...(r.githubSource===undefined?{}:{githubSource:githubSource(r.githubSource)})};
}
export function validateCapabilities(config:AgentConfiguration,check:RuntimeCheck|null){
  if(!config.model&&!config.reasoningEffort)return;
  if(!check||check.catalogState!=='verified')throw new Error('Check runtime to verify model capabilities, or use runtime defaults.');
  const model=check.models.find(model=>model.id===config.model);
  if(!model)throw new Error('This model is no longer advertised by Codex. Check runtime or use runtime defaults.');
  if(config.reasoningEffort&&!model.efforts.some(e=>e.value===config.reasoningEffort))throw new Error('The selected reasoning effort is not supported by this model.');
}
export function storedProfile(input:unknown):AgentProfile {
  const config=validateConfiguration(input),r=input as AgentProfile;
  if(!validId(r.id)||r.configurationVersion!==1||typeof r.createdAt!=='string'||!Number.isFinite(Date.parse(r.createdAt))||typeof r.updatedAt!=='string'||!Number.isFinite(Date.parse(r.updatedAt))||r.defaultProjectPath!==null&&(typeof r.defaultProjectPath!=='string'||r.defaultProjectPath.length>4096||!r.defaultProjectPath.startsWith('/')&&!/^[a-z]:\\/i.test(r.defaultProjectPath)))throw new Error('Invalid saved profile metadata.');
  if(r.archivedAt!==undefined&&(typeof r.archivedAt!=='string'||!Number.isFinite(Date.parse(r.archivedAt))))throw new Error('Invalid archive date.');
  return {...(r.archivedAt?{archivedAt:r.archivedAt}:{}),...config,id:r.id,configurationVersion:1,createdAt:r.createdAt,updatedAt:r.updatedAt,defaultProjectPath:r.defaultProjectPath===null?null:redact(r.defaultProjectPath)};
}
export class AgentProfiles {
  private records=new Map<string,AgentProfile>();
  warning:string|undefined;
  private fatal=false;
  readonly directory:string;
  constructor(userData:string){
    this.directory=join(userData,'agent-profiles');
    try{mkdirSync(this.directory,{recursive:true,mode:0o700});chmodSync(this.directory,0o700);
      for(const file of readdirSync(this.directory).sort()){
        if(!file.endsWith('.json'))continue;
        try{const raw=readFileSync(join(this.directory,file),'utf8');if(raw.length>200000)throw new Error('Oversized');const profile=storedProfile(JSON.parse(raw));if(file!==`${profile.id}.json`)throw new Error('ID mismatch');this.records.set(profile.id,profile);}
        catch{this.warning='Some agent profiles could not be read. Damaged or unsupported files were left untouched for review.';}
      }
    }catch{this.fatal=true;this.warning='Agent profile storage is unavailable. Check user-data permissions and disk space, then restart.';}
  }
  list(){return structuredClone([...this.records.values()].sort((a,b)=>a.id.localeCompare(b.id)));}
  get(id:unknown){if(!validId(id))throw new Error('Invalid agent ID.');const profile=this.records.get(id);if(!profile)throw new Error('Agent profile not found.');return structuredClone(profile);}
  getAvailable(id:unknown,updatedAt?:string){
    const profile=this.get(id);
    if(profile.archivedAt)throw new Error('This agent is archived. Restore it before selecting or starting a task.');
    if(updatedAt!==undefined&&profile.updatedAt!==updatedAt)throw new Error('This agent configuration changed. Select it again to review the current settings.');
    return profile;
  }
  change(input:AgentProfileLifecycleRequest,runs:AgentRun[]=[]){
    if(this.fatal)throw new Error(this.warning);
    if(!input||!['archive','restore','delete'].includes(input.action))throw new Error('Invalid agent lifecycle action.');
    const old=this.get(input.id);
    if(old.updatedAt!==input.expectedUpdatedAt)throw new Error('This agent changed. Refresh the list and try again.');
    if(input.action==='delete'){
      if(runs.some(run=>run.agentConfiguration?.profile?.id===old.id&&isActiveRun(run.status)))throw new Error('This agent has an active run. Stop it or wait for completion before deleting.');
      try{unlinkSync(join(this.directory,`${old.id}.json`));this.syncDirectory();}
      catch{throw new Error('Could not delete agent. Check disk space and user-data directory permissions.');}
      this.records.delete(old.id);return;
    }
    const updatedAt=new Date(Math.max(Date.now(),Date.parse(old.updatedAt)+1)).toISOString();
    const {archivedAt:_,...rest}=old;
    this.write(storedProfile({...rest,updatedAt,...(input.action==='archive'?{archivedAt:updatedAt}:{})}));
  }
  private syncDirectory(){
    if(process.platform!=='win32'){const fd=openSync(this.directory,'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
  }
  save(input:SaveAgentRequest,path:string|null,capabilities:RuntimeCheck|null):AgentProfile {
    if(this.fatal)throw new Error(this.warning);
    const config=validateConfiguration(input);validateCapabilities(config,capabilities);
    const old=input.id===undefined?undefined:this.get(input.id);
    if(old&&old.updatedAt!==input.expectedUpdatedAt)throw new Error('This agent changed since you opened it. Reopen the editor to avoid overwriting changes.');
    if(old?.archivedAt)throw new Error('Restore this agent before editing it.');
    const now=new Date(Math.max(Date.now(),old?Date.parse(old.updatedAt)+1:0)).toISOString();
    const profile=storedProfile({...config,id:old?.id??randomUUID(),configurationVersion:1,createdAt:old?.createdAt??now,updatedAt:now,defaultProjectPath:path});
    return this.write(profile);
  }
  private write(profile:AgentProfile):AgentProfile {
    const target=join(this.directory,`${profile.id}.json`),temporary=`${target}.tmp`;
    try{
      const fd=openSync(temporary,'w',0o600);try{writeFileSync(fd,JSON.stringify(profile,null,2),'utf8');fsyncSync(fd);}finally{closeSync(fd);}
      renameSync(temporary,target);
      this.syncDirectory();
    }catch{throw new Error('Could not save agent. Check free disk space and user-data directory permissions. Your form has been kept.');}
    finally{try{unlinkSync(temporary);}catch{/* committed or absent */}}
    this.records.set(profile.id,profile);return structuredClone(profile);
  }
}
