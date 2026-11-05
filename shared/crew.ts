// The same deterministic routing plan is previewed in the composer and resolved in main.
export const crewRoles = ['orbit','forge','sentinel','scout','quill'] as const;
export type CrewRole = typeof crewRoles[number];
export const crewRoutes = ['auto',...crewRoles,'feature','research'] as const;
export type CrewRoute = typeof crewRoutes[number];
export interface CrewRequest { route:CrewRoute; profiles?:Partial<Record<CrewRole,{id:string;updatedAt:string}>> }
export interface CrewExecution { id:string; role:CrewRole; dependsOn:string[] }
export const roleInstructions:Record<CrewRole,string>={
  orbit:'Plan the task and explain the next actions. Do not claim to spawn agents or execute work outside this owned run.',
  forge:'Implement the requested change and run relevant checks. Summarize changes, validation and remaining risks for the reviewer.',
  sentinel:'Review the task and the current project changes. Report concrete defects and validation gaps. Do not edit files.',
  scout:'Research the task using the project and supplied reference material. Cite evidence and identify gaps; do not invent sources. Do not edit files.',
  quill:'Write the requested deliverable using available evidence and the predecessor handoff, if supplied. Identify unsupported claims.',
};
export function crewPlan(route:CrewRoute,task:string):CrewRole[]{
  if(route==='feature')return ['forge','sentinel'];
  if(route==='research')return ['scout','quill'];
  if(route!=='auto')return [route];
  if(/\b(review|audit)\b/i.test(task))return ['sentinel'];
  if(/\b(research|investigate|compare)\b/i.test(task))return ['scout','quill'];
  if(/\b(write|draft|rewrite)\b/i.test(task))return ['quill'];
  if(/\b(plan|design)\b/i.test(task))return ['orbit'];
  return ['forge','sentinel'];
}
export function validateCrew(input:unknown):CrewRequest {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid crew routing.');
  const r=input as CrewRequest;
  if(Object.keys(r).some(k=>!['route','profiles'].includes(k))||!crewRoutes.includes(r.route))throw new Error('Choose a supported crew route.');
  const profiles:CrewRequest['profiles']={};
  if(r.profiles!==undefined){
    if(!r.profiles||typeof r.profiles!=='object'||Array.isArray(r.profiles))throw new Error('Invalid role profiles.');
    for(const [role,ref] of Object.entries(r.profiles)){
      if(!crewRoles.includes(role as CrewRole)||!ref||Object.keys(ref).some(k=>!['id','updatedAt'].includes(k))||typeof ref.id!=='string'||!/^[a-f0-9-]{36}$/.test(ref.id)||typeof ref.updatedAt!=='string'||!Number.isFinite(Date.parse(ref.updatedAt)))throw new Error('Select a current saved agent for each role.');
      profiles[role as CrewRole]={id:ref.id,updatedAt:ref.updatedAt};
    }
  }
  return {route:r.route,profiles};
}

export const readOnlyRole=(role?:CrewRole)=>role==='orbit'||role==='sentinel'||role==='scout';
export function executionSandbox(run:import('./bridge').AgentRun):'read-only'|'workspace-write'{
  return run.gitWorkflow?.kind==='review'||readOnlyRole(run.crew?.role)?'read-only':run.agentConfiguration?.profile?.sandbox??'workspace-write';
}
