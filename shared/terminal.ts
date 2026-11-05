export type TerminalStatus='running'|'cancelling'|'completed'|'failed'|'cancelled';
export interface TerminalCommand {
  id:string;revision:number;workspaceId:string;projectPath:string;command:string;
  status:TerminalStatus;startedAt:string;endedAt?:string;exitCode?:number;signal?:string;
  output:string;truncated:boolean;error?:string;
}
export interface TerminalRequest {workspaceId:string;command:string}
export interface TerminalState {shell:string;commands:TerminalCommand[]}
export const terminalActive=(status:TerminalStatus)=>status==='running'||status==='cancelling';
export function validateTerminalRequest(input:unknown):TerminalRequest{
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid terminal request.');
  const {workspaceId,command}=input as TerminalRequest;
  if(typeof workspaceId!=='string'||!/^[a-f0-9-]{36}$/i.test(workspaceId))throw new Error('Choose a project folder first.');
  if(typeof command!=='string'||!command.trim()||command.length>16000||command.includes('\0'))throw new Error('Enter a command of up to 16,000 characters without null bytes.');
  return {workspaceId,command};
}
