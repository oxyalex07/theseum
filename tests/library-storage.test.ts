import { afterEach, describe, expect, it, vi } from 'vitest';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LibraryIndex } from '../electron/library-index';

vi.mock('node:fs/promises',async importOriginal=>{
  const actual=await importOriginal<typeof import('node:fs/promises')>();
  return {...actual,open:vi.fn(actual.open)};
});
const directories:string[]=[],limit=2_000_000;
async function fixture() {
  const root=await fs.realpath(await fs.mkdtemp(join(tmpdir(),'theseus-library-storage-')));directories.push(root);
  const project=join(root,'project'),storage=join(root,'storage');await fs.mkdir(project);await fs.mkdir(join(storage,'library'),{recursive:true});
  return {root,project,storage,index:new LibraryIndex(storage)};
}
afterEach(async()=>{vi.mocked(fs.open).mockClear();for(const path of directories.splice(0))await fs.rm(path,{recursive:true,force:true});});

describe('Library manifest boundaries',()=>{
  it.skipIf(process.platform==='win32')('settles the full queue promptly for a FIFO with no writer and preserves it',async()=>{
    const {project,storage,index}=await fixture();expect(spawnSync('mkfifo',[index.file]).status).toBe(0);const before=await fs.lstat(index.file);
    // Isolate the call so a regression cannot strand Vitest's libuv worker on a
    // blocking open. Compile the actual service, not a stand-in implementation.
    const child=spawnSync(process.execPath,['--input-type=commonjs','-e',`
      const {transformSync}=require('esbuild'),{readFileSync}=require('node:fs'),Module=require('node:module');
      const filename=${JSON.stringify(join(process.cwd(),'electron/library-index.ts'))};
      const compiled=new Module(filename);compiled.filename=filename;compiled.paths=module.paths;
      compiled._compile(transformSync(readFileSync(filename,'utf8'),{loader:'ts',format:'cjs',target:'node22'}).code,filename);
      const index=new compiled.exports.LibraryIndex(${JSON.stringify(storage)}),project=${JSON.stringify(project)};
      Promise.allSettled([index.query(project),index.query(project+'-other'),index.import(project,[project],'folder'),index.remove(project,'invented'),index.clear(project),index.inspect(project,'0'.repeat(64))])
        .then(results=>console.log(JSON.stringify(results)));
    `],{timeout:2500,encoding:'utf8'});
    expect(child.error).toBeUndefined();expect(child.status,child.stderr).toBe(0);
    const results=JSON.parse(child.stdout);expect(results).toHaveLength(6);
    for(const result of results.slice(0,2)){expect(result.status).toBe('fulfilled');expect(result.value.warning).toMatch(/storage could not be read/);expect(result.value.files).toEqual([]);}
    for(const result of results.slice(2))expect(result.status).toBe('rejected');
    const after=await fs.lstat(index.file);expect(after.isFIFO()).toBe(true);expect(after.ino).toBe(before.ino);
  });

  it.each(['directory','symlink'])('rejects a manifest %s without reading or replacing the artifact',async(kind)=>{
    const {root,project,index}=await fixture();
    if(kind==='directory')await fs.mkdir(index.file);
    else {await fs.writeFile(join(root,'target.json'),'{}');await fs.symlink(join(root,'target.json'),index.file);}
    const before=await fs.lstat(index.file),state=await index.query(project);
    expect(state.warning).toMatch(/storage could not be read/);expect(state.sources).toEqual([]);
    await expect(index.clear(project)).rejects.toThrow(/storage/);expect((await fs.lstat(index.file)).ino).toBe(before.ino);
    if(kind==='symlink')expect(await fs.readFile(join(root,'target.json'),'utf8')).toBe('{}');
  });

  it.each([limit,limit+1])('enforces the manifest byte boundary at %i bytes',async(bytes)=>{
    const {project,index}=await fixture(),raw='{"version":1,"projects":[]}'.padEnd(bytes,' ');await fs.writeFile(index.file,raw);
    const state=await index.query(project);expect(Boolean(state.warning)).toBe(bytes>limit);expect(state.sources).toEqual([]);
    if(bytes>limit){await expect(index.clear(project)).rejects.toThrow(/storage/);expect(await fs.readFile(index.file,'utf8')).toBe(raw);}
  });

  it('checks the opened descriptor type before reading, even if the manifest path is regular',async()=>{
    const {project,storage,index}=await fixture(),raw='{"version":1,"projects":[]}';await fs.writeFile(index.file,raw);
    const actual=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
    // Simulate a nonregular object substituted at open, after any path check.
    const handle=await actual.open(storage,constants.O_RDONLY|constants.O_NONBLOCK),read=vi.spyOn(handle,'read'),close=vi.spyOn(handle,'close');
    vi.mocked(fs.open).mockResolvedValueOnce(handle);
    expect((await index.query(project)).warning).toMatch(/storage could not be read/);expect(read).not.toHaveBeenCalled();expect(close).toHaveBeenCalledOnce();
    expect(await fs.readFile(index.file,'utf8')).toBe(raw);
  });

  it('bounds a growing manifest to limit plus one bytes, even after short reads',async()=>{
    const {project,index}=await fixture(),raw='{"version":1,"projects":[]}'.padEnd(2048,' ');await fs.writeFile(index.file,raw);
    const actual=await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');let total=0,reads=0,closed=false;
    vi.mocked(fs.open).mockImplementationOnce(async(path,flags,...args)=>{
      expect(path).toBe(index.file);expect((flags as number)&constants.O_NONBLOCK).toBe(constants.O_NONBLOCK);expect((flags as number)&constants.O_NOFOLLOW).toBe(constants.O_NOFOLLOW);
      const handle=await actual.open(path,flags,...args),read=handle.read.bind(handle),close=handle.close.bind(handle);
      handle.read=(async(buffer:Buffer,offset:number,length:number,position:number)=>{
        const result=await read(buffer,offset,Math.min(length,64*1024),position);total+=result.bytesRead;
        if(reads++===0)await fs.appendFile(index.file,' '.repeat(limit*2));
        return result;
      }) as typeof handle.read;
      handle.close=async()=>{closed=true;return close();};return handle;
    });
    const state=await index.query(project);expect(state.warning).toMatch(/storage could not be read/);expect(state.files).toEqual([]);
    expect(reads).toBeGreaterThan(1);expect(total).toBe(limit+1);expect(closed).toBe(true);
    await expect(index.clear(project)).rejects.toThrow(/storage/);expect((await fs.stat(index.file)).size).toBe(raw.length+limit*2);
  });
});
