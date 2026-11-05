import { closeSync, constants, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { validId } from './agent-profiles';
import { redact } from './codex-protocol';
import { LocalMemoryRepository } from './memory-repository';
import { storedScope } from './memory-validation';
import { importGroups, MEMORY_BYTES, mergeMemoryGraph, validatePortableMemory } from './memory-format';
import { memoryTypes, type MemoryScope } from '../shared/memory';
import { deletionImpact, type ExtractionCandidate, type ExtractionReview, type MemoryTransferPreview, type MemoryWorkflowRequest, type MemoryWorkflowResult, type PortableMemory } from '../shared/memory-workflows';

interface WorkflowHost {
  openFile:()=>Promise<string|undefined>;saveFile:()=>Promise<string|undefined>;
  knownProject:(path:string)=>boolean;
  runTask:(id:string)=>{task:string;projectPath:string}|undefined;
}
const bounded=(value:unknown,name:string,max:number)=>{if(typeof value!=='string'||!value.trim()||value.length>max||value.includes('\0'))throw new Error(`${name} is required and must fit ${max} characters.`);return redact(value.trim());};
function readPortable(path:string){
  const entry=lstatSync(path);
  if(entry.isSymbolicLink()||!entry.isFile())throw new Error('Choose a regular JSON file. Symbolic links are not supported.');
  // O_NONBLOCK closes the lstat/open replacement race for FIFOs; fstat still validates the opened object.
  const fd=openSync(path,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));let raw:Buffer;
  try{
    const stat=fstatSync(fd);if(!stat.isFile()||stat.size>MEMORY_BYTES)throw new Error('Choose a regular JSON file of at most 32 MB.');
    const chunks:Buffer[]=[];let total=0;
    // Never read more than the budget plus one overflow byte, even if the file grows after fstat.
    while(true){
      const chunk=Buffer.allocUnsafe(Math.min(64*1024,MEMORY_BYTES+1-total));
      const size=readSync(fd,chunk,0,chunk.length,null);if(!size)break;
      total+=size;if(total>MEMORY_BYTES)throw new Error('Memory file exceeds 32 MB.');
      chunks.push(chunk.subarray(0,size));
    }
    raw=Buffer.concat(chunks,total);
  }finally{closeSync(fd);}
  let parsed:unknown;try{parsed=JSON.parse(raw.toString('utf8'));}catch{throw new Error('Memory file is not valid JSON. Choose a real graph export.');}
  return {envelope:validatePortableMemory(parsed),hash:createHash('sha256').update(raw).digest('hex')};
}
function atomicFile(path:string,raw:string,expected?:string){
  if(Buffer.byteLength(raw)>MEMORY_BYTES)throw new Error('Portable graph exceeds 32 MB.');
  const temporary=join(dirname(path),`.theseus-memory-${randomUUID()}.tmp`);
  try{
    const fd=openSync(temporary,'wx',0o600);try{writeFileSync(fd,raw);fsyncSync(fd);}finally{closeSync(fd);}
    if(existsSync(path)){if(lstatSync(path).isSymbolicLink()||!lstatSync(path).isFile())throw new Error('The destination must be a regular file.');if(expected===undefined)throw new Error('Destination changed. Choose the export destination again.');if(readPortable(path).hash!==expected)throw new Error('The portable file changed. Review it again before publishing.');}
    else if(expected!==undefined)throw new Error('The portable file was removed. Reconnect it before publishing.');
    renameSync(temporary,path);
    if(process.platform!=='win32'){const fd=openSync(dirname(path),'r');try{fsyncSync(fd);}finally{closeSync(fd);}}
  }finally{try{unlinkSync(temporary);}catch{/* replaced or absent */}}
}
export class MemoryWorkflows {
  private transfer?:{preview:MemoryTransferPreview;path:string;hash:string;envelope:PortableMemory;expires:number};
  private extraction?:{review:ExtractionReview;expires:number};
  private sync?:{path:string;owner:PortableMemory['owner']};
  private busy=false;
  private readonly ownerFile:string;
  constructor(private repository:LocalMemoryRepository,userData:string,private host:WorkflowHost){this.ownerFile=join(userData,'memory','portable-owner.json');}
  private assertDestination(path:string){const destination=join(realpathSync(dirname(resolve(path))),basename(path));if([this.repository.file,this.ownerFile].some(own=>resolve(own)===destination))throw new Error('Choose a portable file outside the app’s internal memory storage.');}
  private owner(label:unknown){
    const name=bounded(label,'Owner label',100);let id=randomUUID();
    if(existsSync(this.ownerFile)){const raw=JSON.parse(readFileSync(this.ownerFile,'utf8'));if(!validId(raw.id))throw new Error('The portable owner identity is damaged. Repair it before exporting.');id=raw.id;}
    else{mkdirSync(dirname(this.ownerFile),{recursive:true,mode:0o700});const fd=openSync(this.ownerFile,'wx',0o600);try{writeFileSync(fd,JSON.stringify({id}));fsyncSync(fd);}finally{closeSync(fd);}}
    return {id,label:name};
  }
  private syncState(){return this.sync?{fileName:basename(this.sync.path),owner:this.sync.owner}:undefined;}
  async perform(input:unknown):Promise<MemoryWorkflowResult>{
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid memory workflow.');
    if(this.busy)throw new Error('Finish the current memory file operation first.');
    this.busy=true;
    try{return await this.handle(input as MemoryWorkflowRequest);}finally{this.busy=false;}
  }
  private async handle(request:MemoryWorkflowRequest):Promise<MemoryWorkflowResult>{
    if(request.action==='status')return {sync:this.syncState()};
    if(request.action==='sync-disconnect'){this.sync=undefined;this.transfer=undefined;return {};}
    const graph=this.repository.read();this.repository.expectRevision(graph.revision);
    if(request.action==='export'){
      const owner=this.owner(request.ownerLabel),revision=graph.revision,path=await this.host.saveFile();if(!path)return {cancelled:true};this.assertDestination(path);this.repository.expectRevision(revision);
      // The native save dialog authorizes replacing an existing regular export, including older/damaged JSON.
      const envelope:PortableMemory={format:'theseus-memory',version:1,demo:false,owner,exportedAt:new Date().toISOString(),graph};
      this.exportFile(path,JSON.stringify(envelope,null,2));return {saved:true,sync:this.syncState()};
    }
    if(['import','sync-connect','sync-pull','sync-publish'].includes(request.action)){
      let path:string|undefined;
      if(request.action==='import'||request.action==='sync-connect')path=await this.host.openFile();else path=this.sync?.path;
      if(!path){if(request.action==='import'||request.action==='sync-connect')return {cancelled:true};throw new Error('Choose a portable sync file first.');}
      this.assertDestination(path);const {envelope,hash}=readPortable(path);
      const current=this.repository.read();this.repository.expectRevision(graph.revision);
      const mode=request.action==='sync-publish'?'sync-publish':request.action==='import'?'import':'sync-pull';
      if(request.action!=='import'&&request.action!=='sync-connect'&&this.sync&&this.sync.owner.id!==envelope.owner.id)throw new Error('The portable file owner changed. Reconnect and review the new owner explicitly.');
      const groups=importGroups(current,envelope.graph);
      if(request.action==='sync-connect')this.sync={path,owner:envelope.owner};
      const preview:MemoryTransferPreview={id:randomUUID(),mode,revision:current.revision,fileName:basename(path),owner:envelope.owner,exportedAt:envelope.exportedAt,groups,incomingVersions:envelope.graph.records.length,localVersions:current.records.length,...(mode==='sync-publish'?{outgoing:current.records}:{}),
        warning:'Portable files contain unencrypted facts, project paths, source excerpts, and version history. Only share with people you trust. Imported provenance is a claim from this file, not verified local run ownership. Known credential patterns are redacted. No deletion propagates on pull; publish replaces the file with this device’s entire graph. Independent copies and run transcripts remain separate.'};
      this.transfer={preview,path,hash,envelope,expires:Date.now()+15*60_000};return {transfer:preview,sync:this.syncState()};
    }
    if(request.action==='apply-transfer'){
      const pending=this.transfer;if(!pending||pending.preview.id!==request.id||Date.now()>pending.expires)throw new Error('This file review expired. Open it again.');
      this.repository.expectRevision(pending.preview.revision);
      if(readPortable(pending.path).hash!==pending.hash)throw new Error('The portable file changed. Review it again.');
      if(pending.preview.mode==='sync-publish'){
        if(!this.sync||this.sync.path!==pending.path)throw new Error('Sync file was disconnected. Choose it again.');
        const envelope:PortableMemory={...pending.envelope,graph,exportedAt:new Date().toISOString()};
        atomicFile(pending.path,JSON.stringify(envelope,null,2),pending.hash);this.transfer=undefined;return {saved:true,sync:this.syncState()};
      }
      if(!request.choices||typeof request.choices!=='object'||Array.isArray(request.choices)||Object.keys(request.choices).length>5000)throw new Error('Review conflict choices.');
      const next=mergeMemoryGraph(graph,pending.envelope.graph,request.choices,{ownerId:pending.envelope.owner.id,ownerLabel:pending.envelope.owner.label,exportedAt:pending.envelope.exportedAt});
      this.repository.replaceGraph(next,pending.preview.revision);this.transfer=undefined;return {saved:true,graph:this.repository.read(),sync:this.syncState()};
    }
    if(request.action==='extract'){
      const scope=storedScope(request.scope);
      if(scope.kind==='project'&&!this.host.knownProject(scope.projectPath))throw new Error('Choose a known project scope.');
      let text:string,title:string,runId:string|undefined;
      if(request.source?.kind==='run-task'){
        const run=validId(request.source.runId)?this.host.runTask(request.source.runId):undefined;
        if(!run||scope.kind!=='project'||run.projectPath!==scope.projectPath)throw new Error('Choose a saved user task in its original project.');
        text=bounded(run.task,'User task',32000);title='Saved user task';runId=request.source.runId;
      }else if(request.source?.kind==='user-text'){
        text=bounded(request.source.text,'User-provided text',32000);title=bounded(request.source.title,'Source title',100);
      }else throw new Error('Choose user-provided text or a saved user task. Agent output is not automatically ingested.');
      const review=extractCandidates(text,title,scope,graph.revision,runId);this.extraction={review,expires:Date.now()+15*60_000};return {extraction:review};
    }
    if(request.action==='save-extraction'){
      const pending=this.extraction;if(!pending||pending.review.id!==request.id||Date.now()>pending.expires)throw new Error('Extraction review expired. Generate proposals again.');
      this.repository.expectRevision(pending.review.revision);
      if(!Array.isArray(request.candidates)||!request.candidates.length||request.candidates.length>50||new Set(request.candidates.map(c=>c.id)).size!==request.candidates.length)throw new Error('Select between 1 and 50 distinct proposals.');
      const writes=request.candidates.map(c=>{
        const proposed=pending.review.candidates.find(p=>p.id===c.id);if(!proposed)throw new Error('Unknown extraction proposal. Generate proposals again.');
        if(!memoryTypes.includes(c.nodeType))throw new Error('Choose a supported memory type.');
        return {kind:'node' as const,nodeType:c.nodeType,label:bounded(c.label,'Label',100),meaning:bounded(c.meaning,'Meaning',4000),scope:proposed.scope,source:proposed.source};
      });
      this.repository.saveMany(writes,pending.review.revision);this.extraction=undefined;return {saved:true,graph:this.repository.read()};
    }
    if(request.action==='delete-preview'||request.action==='delete-confirm'){
      if(!Array.isArray(request.ids)||!request.ids.length||request.ids.length>5000||request.ids.some(id=>!validId(id))||new Set(request.ids).size!==request.ids.length)throw new Error('Select distinct saved memories.');
      if(request.action==='delete-preview')return {impact:deletionImpact(graph,request.ids)};
      this.repository.deleteMany(request.ids,request.revision);return {saved:true,graph:this.repository.read()};
    }
    throw new Error('Unsupported memory workflow.');
  }
  private exportFile(path:string,raw:string){
    if(Buffer.byteLength(raw)>MEMORY_BYTES)throw new Error('Portable graph exceeds 32 MB.');
    const temp=join(dirname(path),`.theseus-export-${randomUUID()}.tmp`);
    try{if(existsSync(path)&&(!lstatSync(path).isFile()||lstatSync(path).isSymbolicLink()))throw new Error('Choose a regular export file.');const fd=openSync(temp,'wx',0o600);try{writeFileSync(fd,raw);fsyncSync(fd);}finally{closeSync(fd);}renameSync(temp,path);}finally{try{unlinkSync(temp);}catch{/* absent */}}
  }
}
export function extractCandidates(text:string,title:string,scope:MemoryScope,revision:number,runId?:string):ExtractionReview {
  const sentences=text.split(/\r?\n|(?<=[.!?])\s+(?=[A-Z])/u).map(s=>s.trim().replace(/^[-*•]\s*/,'' )).filter(Boolean);
  const candidates:ExtractionCandidate[]=[],seen=new Set<string>();let omitted=0;
  for(const sentence of sentences){
    const lower=sentence.toLowerCase();let nodeType:ExtractionCandidate['nodeType']|undefined;
    if(/\b(prefer|prefers|preference|always|never|avoid|favorite|favourite)\b/.test(lower))nodeType='preference';
    else if(/\b(goal|aim|objective|need to|must|should|plan to|want to|we need|i want)\b/.test(lower))nodeType='goal';
    else if(/\b(use|uses|using|built with|written in|depends on|stack)\b/.test(lower))nodeType='technology';
    if(!nodeType||seen.has(lower))continue;seen.add(lower);
    if(sentence.length>1000||candidates.length>=50){omitted++;continue;}
    candidates.push({id:randomUUID(),label:sentence.length>80?`${sentence.slice(0,77)}…`:sentence,meaning:sentence,nodeType,scope:structuredClone(scope),source:{kind:'extraction',method:'local-rules-v1',title,excerpt:sentence,...(runId?{runId}:{})}});
  }
  return {id:randomUUID(),revision,candidates,omitted,method:'local-rules-v1'};
}
