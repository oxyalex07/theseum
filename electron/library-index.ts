import { constants } from 'node:fs';
import { lstat, realpath, open, opendir, mkdir, writeFile, rename, unlink } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { LibraryFile, LibraryFileStatus, LibraryPreview, LibrarySource, LibraryState } from '../shared/library';

export const LIBRARY_LIMITS = Object.freeze({ fileBytes: 256 * 1024, projectBytes: 8 * 1024 * 1024, files: 1000, results: 200 });
const extensions = new Set(['.txt','.md','.mdx','.rst','.json','.jsonc','.yaml','.yml','.toml','.xml','.csv','.tsv','.html','.htm','.css','.scss','.sass','.less','.js','.jsx','.mjs','.cjs','.ts','.tsx','.mts','.cts','.py','.rb','.rs','.go','.java','.kt','.kts','.swift','.c','.h','.cpp','.hpp','.cs','.sh','.bash','.zsh','.sql','.graphql','.gql','.vue','.svelte','.ini','.cfg','.conf','.lock','.prisma','.proto']);
const filenames = new Set(['Dockerfile','Makefile','LICENSE','LICENCE','NOTICE','README']);
const ignoredDirectories = new Set(['node_modules','dist','dist-electron','build','coverage','vendor']);
const manifestBytes = 2_000_000;
interface Project { path: string; sources: LibrarySource[]; known: string[] }
interface Scan { rows: LibraryFile[]; text: Map<string,string>; known: string[]; warning?: string }
const idFor = (path:string) => createHash('sha256').update(path).digest('hex');
const inside = (root:string,path:string) => { const part=relative(root,path);return part===''||!part.startsWith(`..${sep}`)&&part!=='..'&&!isAbsolute(part); };
const validRelative = (path:unknown):path is string => typeof path==='string'&&path.length<=4096&&!path.includes('\0')&&!isAbsolute(path)&&path!==''&&(path==='.'||path.split(/[\\/]/).every(part=>part!=='.'&&part!=='..'&&part!==''));
const selectedBy = (path:string,source:LibrarySource) => source.kind==='file'?path===source.path:inside(resolve('/',source.path),resolve('/',path));
const validKnown = (project:Project) => project.known.length<=LIBRARY_LIMITS.files&&new Set(project.known).size===project.known.length&&project.known.every(path=>validRelative(path)&&project.sources.some(source=>selectedBy(path,source)));
const excluded = (path:string) => path.split(/[\\/]/).some(part=>part.startsWith('.')&&part!=='.'||ignoredDirectories.has(part));
function contentMatch(content:string,needle:string):number {
  const folded=content.toLowerCase(),index=folded.indexOf(needle);
  if(index<0||folded.length===content.length)return index;
  // Keep whole-string lowercase semantics (including contextual sigma), but map
  // expanding characters such as U+0130 back to their original UTF-16 offsets.
  let originalOffset=0,foldedOffset=0;
  for(const character of content) {
    foldedOffset+=character.toLowerCase().length;
    if(foldedOffset>index)return originalOffset;
    originalOffset+=character.length;
  }
  return -1;
}
function failure(error:unknown):{status:LibraryFileStatus;message:string} {
  const code=(error as NodeJS.ErrnoException)?.code;
  if(code==='ENOENT'||code==='ENOTDIR')return {status:'removed',message:'File or folder was removed or moved. Refresh after restoring it, or remove its import.'};
  if(code==='BOUNDARY')return {status:'unsupported',message:'Symlinks and paths outside the selected project are not indexed.'};
  return {status:'inaccessible',message:'Cannot read this file. Check permissions, then refresh.'};
}
const boundary = () => Object.assign(new Error('Select a regular file or folder inside the selected project; symlinks are not supported.'),{code:'BOUNDARY'});

/** Main-process only. Persists selection metadata, never file contents. Every search rereads bounded files. */
export class LibraryIndex {
  readonly file:string;
  private projects:Project[]=[];
  private warning='';
  private loaded=false;
  private tail:Promise<unknown>=Promise.resolve();
  constructor(private directory:string) { this.file=join(directory,'library','selections.json'); }
  private serial<T>(action:()=>Promise<T>):Promise<T> { const next=this.tail.then(action,action);this.tail=next.catch(()=>{});return next; }
  private async load() {
    if(this.loaded)return;this.loaded=true;
    try {
      const handle=await open(this.file,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
      let raw:string;
      try {
        const before=await handle.stat();
        if(!before.isFile()||before.size>manifestBytes)throw new Error();
        const buffer=Buffer.alloc(manifestBytes+1);let size=0;
        while(size<buffer.length){const result=await handle.read(buffer,size,buffer.length-size,size);if(!result.bytesRead)break;size+=result.bytesRead;}
        const after=await handle.stat();
        if(size>manifestBytes||before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw new Error();
        raw=new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,size));
      } finally {await handle.close();}
      const data=JSON.parse(raw);
      if(data.version!==1||!Array.isArray(data.projects)||data.projects.length>20)throw new Error();
      const paths=new Set<string>();
      this.projects=data.projects.map((value:Project)=>{
        if(!value||typeof value.path!=='string'||!isAbsolute(value.path)||value.path!==resolve(value.path)||paths.has(value.path)||!Array.isArray(value.sources)||value.sources.length>40||!Array.isArray(value.known)||value.known.length>LIBRARY_LIMITS.files)throw new Error();
        paths.add(value.path);const ids=new Set<string>(),choices=new Set<string>();
        const sources=value.sources.map(source=>{
          if(!source||typeof source.id!=='string'||!/^[a-f0-9-]{36}$/.test(source.id)||ids.has(source.id)||!validRelative(source.path)||choices.has(source.path)||!['file','folder'].includes(source.kind))throw new Error();
          ids.add(source.id);choices.add(source.path);return {id:source.id,path:source.path,kind:source.kind};
        });
        const project={path:value.path,sources,known:[...value.known]};
        if(!validKnown(project))throw new Error();
        return project;
      });
    } catch(error) {
      if((error as NodeJS.ErrnoException).code!=='ENOENT')this.warning='Library selection storage could not be read. Existing storage was left untouched; restore it before importing or removing files.';
    }
  }
  private async save(projects:Project[]) {
    if(this.warning)throw new Error(this.warning);
    if(projects.some(project=>!validKnown(project)))throw new Error('Library file paths do not match the retained imports. No selection changes were saved.');
    const raw=JSON.stringify({version:1,projects});if(Buffer.byteLength(raw)>manifestBytes)throw new Error('Library selection metadata is full. Remove an import first.');
    await mkdir(dirname(this.file),{recursive:true,mode:0o700});
    const temp=`${this.file}.${randomUUID()}.tmp`;
    try {await writeFile(temp,raw,{mode:0o600,flag:'wx'});await rename(temp,this.file);this.projects=projects;}
    catch {throw new Error('Could not save Library selections. Check disk space and permissions; no selection changes were saved.');}
    finally {await unlink(temp).catch(()=>{});}
  }
  private project(path:string):Project {return this.projects.find(project=>project.path===path)??{path,sources:[],known:[]};}
  private async commit(project:Project) {
    const projects=this.projects.filter(value=>value.path!==project.path);
    if(project.sources.length)projects.push(project);
    if(projects.length>20)throw new Error('At most 20 projects can have Library imports. Clear another project first.');
    await this.save(projects);
  }
  /** Rejects symlinks in every path component and verifies canonical containment, including on refresh. */
  private async safe(root:string,path:string) {
    if(!isAbsolute(root)||root!==resolve(root)||!inside(root,path))throw boundary();
    if(await realpath(root)!==root||(await lstat(root)).isSymbolicLink())throw boundary();
    let current=root;
    for(const part of relative(root,path).split(sep).filter(Boolean)) {
      current=join(current,part);if((await lstat(current)).isSymbolicLink())throw boundary();
    }
    if(await realpath(path)!==path)throw boundary();
    return lstat(path);
  }
  private async read(root:string,path:string):Promise<{text?:string;file:Omit<LibraryFile,'id'|'path'>}> {
    try {
      const stat=await this.safe(root,path),part=relative(root,path);
      if(excluded(part))return {file:{status:'unsupported',message:'Hidden files and dependency/build directories are excluded.'}};
      if(!stat.isFile()||!extensions.has(extname(path).toLowerCase())&&!filenames.has(basename(path)))return {file:{status:'unsupported',message:'Only supported UTF-8 text and source files can be indexed.'}};
      if(stat.size>LIBRARY_LIMITS.fileBytes)return {file:{status:'too-large',message:'File exceeds the 256 KiB per-file limit.',size:stat.size}};
      // O_NONBLOCK avoids blocking on a FIFO substituted after lstat. Never follow a final-component symlink.
      const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
      try {
        const before=await handle.stat();if(!before.isFile()||before.ino!==stat.ino||before.dev!==stat.dev)throw boundary();
        const buffer=Buffer.alloc(LIBRARY_LIMITS.fileBytes+1);let size=0;
        while(size<buffer.length){const result=await handle.read(buffer,size,buffer.length-size,size);if(!result.bytesRead)break;size+=result.bytesRead;}
        const after=await handle.stat(),current=await this.safe(root,path);
        if(after.ino!==current.ino||after.dev!==current.dev||before.mtimeMs!==after.mtimeMs||before.size!==after.size||after.mtimeMs!==current.mtimeMs||after.size!==current.size)throw new Error('File changed during read');
        if(size>LIBRARY_LIMITS.fileBytes)return {file:{status:'too-large',message:'File exceeds the 256 KiB per-file limit.',size}};
        let text:string;
        try {text=new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,size));if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw new Error();}
        catch {return {file:{status:'unsupported',message:'Binary files and non-UTF-8 text are not supported.'}};}
        return {text,file:{status:'indexed',size,modifiedAt:after.mtime.toISOString()}};
      } finally {await handle.close();}
    }catch(error){return {file:failure(error)};}
  }
  private async scan(project:Project):Promise<Scan> {
    const paths=new Set<string>(),issues:LibraryFile[]=[],messages:string[]=[];
    let visited=0,limited=false;
    const walk=async(path:string,depth:number,kind?:LibrarySource['kind']):Promise<void>=>{
      if(paths.size>=LIBRARY_LIMITS.files||visited++>=4000||depth>32){limited=true;return;}
      try {
        const stat=await this.safe(project.path,path),part=relative(project.path,path)||'.';
        if(kind==='file'&&!stat.isFile()||kind==='folder'&&!stat.isDirectory()) {
          issues.push({id:idFor(part),path:part,status:'unsupported',message:`The imported ${kind} is no longer a regular ${kind==='file'?'file':'folder'}. Restore it, or remove this import and select again.`});return;
        }
        if(stat.isDirectory()) {
          if(excluded(part)){issues.push({id:idFor(part),path:part,status:'unsupported',message:'Hidden and dependency/build directories are excluded.'});return;}
          const directory=await opendir(path);
          // Recheck after opening, before any directory names enter the index.
          try {await this.safe(project.path,path);}catch(error){await directory.close();throw error;}
          for await(const entry of directory){await this.safe(project.path,path);await walk(join(path,entry.name),depth+1);if(limited)break;}
        } else paths.add(part);
      }catch(error){const part=relative(project.path,path)||'.';issues.push({id:idFor(part),path:part,...failure(error)});}
    };
    for(const source of project.sources)await walk(resolve(project.path,source.path),0,source.kind);
    const known=[...new Set([...project.known,...paths])].slice(0,LIBRARY_LIMITS.files);
    if(paths.size+project.known.filter(path=>!paths.has(path)).length>LIBRARY_LIMITS.files)limited=true;
    const text=new Map<string,string>(),rows=new Map<string,LibraryFile>();let bytes=0;
    for(const path of known) {
      const result=await this.read(project.path,resolve(project.path,path)),id=idFor(path);
      if(result.text!==undefined){
        if(bytes+(result.file.size??0)>LIBRARY_LIMITS.projectBytes){result.file={status:'limit',message:'Project content exceeds 8 MiB. Remove imports to index this file.'};limited=true;}
        else {bytes+=result.file.size??0;text.set(id,result.text);}
      }
      rows.set(path,{id,path,...result.file});
    }
    for(const issue of issues){rows.set(issue.path,issue);text.delete(issue.id);}
    if(limited)messages.push('Index limit reached: up to 1,000 files, 8 MiB of text, 4,000 directory entries and 32 folder levels per project. Narrow your imports for complete results.');
    return {rows:[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path)),known,text,warning:messages.join(' ')||undefined};
  }
  private async state(project:Project,search:string):Promise<LibraryState> {
    const scan=await this.scan(project);
    if(!this.warning&&JSON.stringify(scan.known)!==JSON.stringify(project.known)){
      const next={...project,known:scan.known};try{await this.commit(next);}catch(error){scan.warning=[scan.warning,(error as Error).message].filter(Boolean).join(' ');}
    }
    const needle=search.trim().toLowerCase();
    const files=scan.rows.flatMap(file=>{
      const content=scan.text.get(file.id),index=needle&&content!==undefined?contentMatch(content,needle):-1;
      if(needle&&!file.path.toLowerCase().includes(needle)&&index<0)return [];
      if(index>=0&&content!==undefined){const start=content.lastIndexOf('\n',index)+1,end=content.indexOf('\n',index);return [{...file,line:content.slice(0,index).split('\n').length,snippet:content.slice(Math.max(start,index-80),Math.min(end<0?content.length:end,index+200)).trim()}];}
      return [file];
    });
    return {projectPath:project.path,sources:project.sources,files:files.slice(0,LIBRARY_LIMITS.results),totalFiles:scan.rows.length,indexedFiles:scan.rows.filter(file=>file.status==='indexed').length,matchingFiles:files.length,checkedAt:new Date().toISOString(),limits:LIBRARY_LIMITS,warning:[this.warning,scan.warning].filter(Boolean).join(' ')||undefined};
  }
  private scope(root:unknown,search:unknown):{root:string;search:string} {
    if(typeof root!=='string'||!isAbsolute(root)||root!==resolve(root)||root.includes('\0')||typeof search!=='string'||search.length>500)throw new Error('Invalid Library project or search.');
    return {root,search};
  }
  query(root:unknown,search:unknown=''):Promise<LibraryState> {return this.serial(async()=>{const scope=this.scope(root,search);await this.load();return this.state(this.project(scope.root),scope.search);});}
  /** Called with native-dialog results only, never renderer-supplied paths. All selections validate before saving. */
  import(root:unknown,paths:unknown,kind:unknown,search:unknown=''):Promise<LibraryState> {
    return this.serial(async()=>{
      const scope=this.scope(root,search);await this.load();
      if(!Array.isArray(paths)||!paths.length||paths.length>40||kind!=='files'&&kind!=='folder'||kind==='folder'&&paths.length!==1)throw new Error('Choose at most 40 files or one folder.');
      const project=structuredClone(this.project(scope.root));
      for(const path of paths) {
        if(typeof path!=='string'||path.includes('\0')||!isAbsolute(path)||path!==resolve(path))throw boundary();
        const stat=await this.safe(scope.root,path);
        if(kind==='folder'?!stat.isDirectory():!stat.isFile())throw new Error('Choose regular files or a project folder.');
        const part=relative(scope.root,path)||'.';
        if(!project.sources.some(source=>source.path===part))project.sources.push({id:randomUUID(),path:part,kind:kind==='folder'?'folder':'file'});
      }
      if(project.sources.length>40)throw new Error('At most 40 imports are supported per project. Remove an import first.');
      await this.commit(project);return this.state(project,scope.search);
    });
  }
  remove(root:unknown,sourceId:unknown,search:unknown=''):Promise<LibraryState> {
    return this.serial(async()=>{
      const scope=this.scope(root,search);await this.load();const current=this.project(scope.root);
      if(typeof sourceId!=='string'||!current.sources.some(source=>source.id===sourceId))throw new Error('Import does not belong to this project. Refresh the Library.');
      const sources=current.sources.filter(source=>source.id!==sourceId),project={...current,sources,known:current.known.filter(path=>sources.some(source=>selectedBy(path,source)))};
      await this.commit(project);return this.state(project,scope.search);
    });
  }
  clear(root:unknown,search:unknown=''):Promise<LibraryState> {return this.serial(async()=>{const scope=this.scope(root,search);await this.load();const project={path:scope.root,sources:[],known:[]};await this.commit(project);return this.state(project,scope.search);});}
  inspect(root:unknown,fileId:unknown):Promise<LibraryPreview> {
    return this.serial(async()=>{
      const scope=this.scope(root,'');await this.load();const project=this.project(scope.root);
      if(typeof fileId!=='string'||!/^[a-f0-9]{64}$/.test(fileId))throw new Error('Invalid Library file.');
      // The persisted manifest is main-owned, scoped, and refreshed before any content is returned.
      const scan=await this.scan(project),file=scan.rows.find(row=>row.id===fileId);
      if(!file)throw new Error('This file is no longer imported in the selected project. Refresh the Library.');
      return {projectPath:scope.root,file,content:scan.text.get(fileId)??null};
    });
  }
}
