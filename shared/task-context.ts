/** Built-in prompt workflows, not shell commands or installed Codex skills. */
export const taskInvocations = [
  {id:'review',token:'/review',kind:'command',label:'Review changes',description:'Ask Codex to inspect changes and report findings before editing.',instructions:'Review the current project changes for bugs and regressions. Report actionable findings with file references. Do not edit files unless the user explicitly requests fixes.'},
  {id:'explain',token:'/explain',kind:'command',label:'Explain code',description:'Ask Codex to trace relevant code and explain its behavior.',instructions:'Trace the relevant code and explain its behavior with concrete file references. Do not edit files unless the user explicitly requests changes.'},
  {id:'plan',token:'$plan',kind:'skill',label:'Plan a task',description:'Built-in planning workflow: inspect, identify constraints, then propose steps.',instructions:'Use the built-in planning workflow: inspect relevant code, identify constraints and risks, and produce an actionable implementation plan. Wait for the user to request implementation before editing.'},
  {id:'test',token:'$test',kind:'skill',label:'Verify behavior',description:'Built-in testing workflow: identify and run relevant local checks.',instructions:'Use the built-in verification workflow: identify the relevant existing tests, run appropriate local checks, and report results and limitations. Do not use paid services or account-consuming tests without explicit user authorization.'},
] as const;
export type InvocationId=typeof taskInvocations[number]['id'];
export interface TaskContextRequest { fileTokens:string[]; invocationIds:InvocationId[] }
export interface TaskFileReview {token:string;fileId:string;path:string;content:string;sha256:string;reviewedAt:string}
export interface TaskContextSelection {files:Omit<TaskFileReview,'token'|'content'>[];invocationIds:InvocationId[]}
export const TASK_CONTEXT_LIMITS={files:5,fileCharacters:32000,totalCharacters:64000} as const;
export function validateTaskContext(input:unknown):TaskContextRequest {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid task context.');
  const value=input as Record<string,unknown>;
  if(Object.keys(value).some(key=>!['fileTokens','invocationIds'].includes(key))||!Array.isArray(value.fileTokens)||value.fileTokens.length>TASK_CONTEXT_LIMITS.files||value.fileTokens.some(id=>typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))||new Set(value.fileTokens).size!==value.fileTokens.length)throw new Error('Select at most five reviewed files.');
  if(!Array.isArray(value.invocationIds)||value.invocationIds.length>2||value.invocationIds.some(id=>!taskInvocations.some(item=>item.id===id))||new Set(value.invocationIds).size!==value.invocationIds.length||value.invocationIds.filter(id=>taskInvocations.some(item=>item.id===id&&item.kind==='command')).length>1||value.invocationIds.filter(id=>taskInvocations.some(item=>item.id===id&&item.kind==='skill')).length>1)throw new Error('Choose one supported command and one built-in skill.');
  return {fileTokens:[...value.fileTokens] as string[],invocationIds:[...value.invocationIds] as InvocationId[]};
}

/** History contains provenance only, never attachment contents or live receipts. */
export function storedTaskContext(input:unknown):TaskContextSelection {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid saved task context.');
  const value=input as TaskContextSelection;
  const invocationIds=validateTaskContext({fileTokens:[],invocationIds:value.invocationIds}).invocationIds;
  if(!Array.isArray(value.files)||value.files.length>5)throw new Error('Invalid saved file references.');
  const files=value.files.map(file=>{
    if(!file||typeof file.fileId!=='string'||!/^[a-f0-9]{64}$/.test(file.fileId)||typeof file.sha256!=='string'||!/^[a-f0-9]{64}$/.test(file.sha256)||typeof file.path!=='string'||file.path.length>4096||/^(?:[\\/]|[A-Za-z]:)/.test(file.path)||file.path.includes('\0')||file.path.split(/[\\/]/).some(part=>!part||part==='..'||part==='.')||typeof file.reviewedAt!=='string'||!Number.isFinite(Date.parse(file.reviewedAt)))throw new Error('Invalid saved file reference.');
    return {fileId:file.fileId,path:file.path,sha256:file.sha256,reviewedAt:file.reviewedAt};
  });
  if(new Set(files.map(file=>file.fileId)).size!==files.length)throw new Error('Duplicate saved file references.');
  return {files,invocationIds};
}
export interface TaskAttachment {review:TaskFileReview;included:boolean}
