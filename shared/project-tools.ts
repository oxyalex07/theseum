export type ProjectTarget = {workspaceId:string;runId?:never}|{runId:string;workspaceId?:never};
export interface TerminalSize {cols:number;rows:number}
export interface ProjectShell {
  id:string;targetKey:string;projectPath:string;shell:string;status:'running'|'stopping'|'exited';
  revision:number;output:string;outputStart:number;cols:number;rows:number;
  startedAt:string;endedAt?:string;exitCode?:number;signal?:number;error?:string;
}
export interface ProjectPreview {targetKey:string;projectPath:string;url:string;title:string;loading:boolean;error:string}
export function projectTarget(input:unknown):ProjectTarget{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Choose a project or saved run.');
  const {workspaceId,runId}=input as ProjectTarget;
  if((workspaceId===undefined)===(runId===undefined))throw new Error('Choose exactly one project or saved run.');
  const id=workspaceId??runId;
  if(typeof id!=='string'||!/^[a-f0-9-]{36}$/i.test(id))throw new Error('Invalid project identifier.');
  return workspaceId!==undefined?{workspaceId}:{runId:runId!};
}
export function targetKey(target:ProjectTarget){return 'workspaceId' in target&&target.workspaceId?`workspace:${target.workspaceId}`:`run:${target.runId}`;}
export function terminalSize(input:unknown):TerminalSize{
  const size=input as TerminalSize;
  if(!size||!Number.isInteger(size.cols)||!Number.isInteger(size.rows)||size.cols<2||size.cols>500||size.rows<1||size.rows>200)throw new Error('Invalid terminal size.');
  return {cols:size.cols,rows:size.rows};
}
export function terminalInput(input:unknown):{id:string;data:string}{
  const value=input as {id:string;data:string};
  if(!value||typeof value.id!=='string'||typeof value.data!=='string'||!value.data.length||value.data.length>16000||value.data.includes('\0'))throw new Error('Invalid terminal input (maximum 16,000 characters).');
  return {id:value.id,data:value.data};
}
export function localPreviewUrl(input:unknown):string{
  if(typeof input!=='string'||input.length>4096||/[\s\u0000-\u001f\\]/.test(input))throw new Error('Enter a local HTTP or HTTPS URL.');
  let url:URL;try{url=new URL(input);}catch{throw new Error('Enter a full local URL, such as http://localhost:5173.');}
  if(!['http:','https:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password)throw new Error('Preview requires localhost, 127.0.0.1, or [::1] with no credentials.');
  return url.href;
}
export function previewCandidates(output:string):string[]{
  const found=new Set<string>();
  // Strip ANSI color codes before finding URLs printed by common development servers.
  const plain=output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'');
  for(const match of plain.matchAll(/https?:\/\/[^\s<>"'`\x1b]+/g)){
    try{found.add(localPreviewUrl(match[0].replace(/[),.;]+$/,'')));}catch{/* Ignore invalid output. */}
  }
  return [...found].slice(-10).reverse();
}
