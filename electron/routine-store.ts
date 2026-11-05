import { constants, mkdirSync, lstatSync, realpathSync, openSync, fstatSync, readSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { TextDecoder } from 'node:util';
import { routineFields, routineId, routineTimestamp, type Routine, type RoutineExecution } from '../shared/routines';

export interface RoutineDocument { version:1; routines:Routine[]; executions:RoutineExecution[]; paused?:boolean; sessionActive?:boolean }
const limit=3_000_000,noFollow=constants.O_NOFOLLOW??0;
export const routineStorageError='Routine storage is unavailable or damaged. Automatic execution is stopped. Pending routine work cannot start; already running work continues. Recent history changes are in memory only. Repair routines.json in app user data, then explicitly resume scheduling.';
function validDocument(value:unknown):RoutineDocument {
  if(!value||typeof value!=='object')throw new Error(routineStorageError);
  const d=value as RoutineDocument;
  if(d.version!==1||d.paused!==undefined&&typeof d.paused!=='boolean'||d.sessionActive!==undefined&&typeof d.sessionActive!=='boolean'||!Array.isArray(d.routines)||d.routines.length>100||!Array.isArray(d.executions)||d.executions.length>500)throw new Error(routineStorageError);
  const ids=new Set<string>();
  const routines=d.routines.map(r=>{
    const fields=routineFields(r);
    if(!routineId(r.id)||ids.has(r.id)||!Number.isSafeInteger(r.revision)||r.revision<1||typeof r.projectPath!=='string'||!isAbsolute(r.projectPath)||r.projectPath.includes('\0')||typeof r.profileName!=='string'||r.profileName.length>80||!['read-only','workspace-write'].includes(r.sandbox)||!routineTimestamp(r.createdAt)||!routineTimestamp(r.updatedAt)||r.nextRunAt!==null&&!routineTimestamp(r.nextRunAt)||(!r.enabled||fields.trigger.kind.startsWith('run-'))&&r.nextRunAt!==null||r.enabled&&['interval','weekly'].includes(fields.trigger.kind)&&r.nextRunAt===null)throw new Error(routineStorageError);
    ids.add(r.id);return {...fields,id:r.id,revision:r.revision,projectPath:r.projectPath,profileName:r.profileName,sandbox:r.sandbox,createdAt:r.createdAt,updatedAt:r.updatedAt,nextRunAt:r.nextRunAt};
  });
  ids.clear();
  const executions=d.executions.map(e=>{
    if(!e||!routineId(e.id)||ids.has(e.id)||!routineId(e.routineId)||typeof e.routineName!=='string'||e.routineName.length>80||!Number.isSafeInteger(e.revision)||e.revision<1||typeof e.triggerKey!=='string'||e.triggerKey.length>200||!routineTimestamp(e.triggeredAt)||!['preparing','skipped','queued','starting','running','cancelling','completed','cancelled','failed','interrupted'].includes(e.status)||e.runId!==undefined&&!routineId(e.runId)||e.endedAt!==undefined&&!routineTimestamp(e.endedAt)||e.detail!==undefined&&(typeof e.detail!=='string'||e.detail.length>2000))throw new Error(routineStorageError);
    ids.add(e.id);return {...e};
  });
  return {version:1,routines,executions,paused:!!d.paused,sessionActive:!!d.sessionActive};
}
/** Bounded, nonblocking, no-follow reads; private fsynced atomic writes. Never repair damaged data implicitly. */
export class RoutineStore {
  private file:string;
  private identity?:{ino:number;dev:number};
  constructor(private directory:string){this.file=join(directory,'routines.json');}
  private folder(){mkdirSync(this.directory,{recursive:true,mode:0o700});const s=lstatSync(this.directory);if(!s.isDirectory()||s.isSymbolicLink()||realpathSync(this.directory)!==this.directory||this.identity&&(this.identity.ino!==s.ino||this.identity.dev!==s.dev))throw new Error(routineStorageError);this.identity??={ino:s.ino,dev:s.dev};return s;}
  private existing(){try{const s=lstatSync(this.file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>limit)throw new Error(routineStorageError);return s;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}}
  load():RoutineDocument {
    this.folder();const before=this.existing();if(!before)return {version:1,routines:[],executions:[]};
    const fd=openSync(this.file,constants.O_RDONLY|constants.O_NONBLOCK|noFollow);
    try{
      const s=fstatSync(fd);if(!s.isFile()||s.nlink!==1||s.size>limit||s.ino!==before.ino||s.dev!==before.dev)throw new Error(routineStorageError);
      const buffer=Buffer.alloc(limit+1);let size=0,count=0;
      while(size<buffer.length&&(count=readSync(fd,buffer,size,buffer.length-size,null))>0)size+=count;
      const after=fstatSync(fd);if(size>limit||after.size!==s.size||after.mtimeMs!==s.mtimeMs)throw new Error(routineStorageError);
      return validDocument(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,size))));
    }finally{closeSync(fd);}
  }
  save(document:RoutineDocument){
    const text=JSON.stringify(validDocument(document));if(Buffer.byteLength(text)>limit)throw new Error('Routine storage exceeds 3 MB. Shorten tasks or delete routines.');
    const folder=this.folder(),before=this.existing(),temporary=join(this.directory,`${randomUUID()}.routine-tmp`);
    try{
      const fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|noFollow,0o600);
      try{writeFileSync(fd,text,'utf8');fsyncSync(fd);}finally{closeSync(fd);}
      const current=this.folder(),existing=this.existing();if(current.ino!==folder.ino||current.dev!==folder.dev||before?.ino!==existing?.ino||before?.dev!==existing?.dev)throw new Error(routineStorageError);
      renameSync(temporary,this.file);
      if(process.platform!=='win32'){const dir=openSync(this.directory,constants.O_RDONLY|noFollow);try{fsyncSync(dir);}finally{closeSync(dir);}}
    }finally{try{unlinkSync(temporary);}catch{/* already renamed or cleanup unavailable */}}
  }
}
