// No Electron/provider required: killable production-source filesystem race regressions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync, execFileSync } from 'node:child_process';
import { buildSync } from 'esbuild';
const require=createRequire(import.meta.url);
const mode=process.argv[2],directory=mode?process.argv[3]:fs.mkdtempSync(join(tmpdir(),'theseus-memory-security-'));
const bundle=join(directory,'workflows.cjs');
if(!mode)buildSync({entryPoints:[resolve('electron/memory-workflows.ts')],bundle:true,platform:'node',format:'cjs',outfile:bundle});
const {MemoryWorkflows}=require(bundle);
// Bundle the repository alongside the workflow to exercise its real disk/memory atomicity.
const repoBundle=join(directory,'repository.cjs');
if(!mode)buildSync({entryPoints:[resolve('electron/memory-repository.ts')],bundle:true,platform:'node',format:'cjs',outfile:repoBundle});
const {LocalMemoryRepository}=require(repoBundle);
function setup(name){const dir=join(directory,name);fs.mkdirSync(dir);const repo=new LocalMemoryRepository(dir),file=join(dir,'portable.json');const service=new MemoryWorkflows(repo,dir,{openFile:async()=>file,saveFile:async()=>file,knownProject:()=>false,runTask:()=>undefined});return {repo,file,service};}
const fact={kind:'node',nodeType:'preference',label:'Reply style',meaning:'Prefer brief replies.',scope:{kind:'personal'},source:{kind:'manual',note:'Reviewed'}};
try{
  if(mode){
    const {repo,file,service}=setup(mode);repo.save(fact);await service.perform({action:'export',ownerLabel:'Device'});
    const sync=mode.includes('sync');if(sync)await service.perform({action:'sync-connect'});
    const before=repo.read(),disk=fs.readFileSync(repo.file,'utf8'),open=fs.openSync;
    if(mode.startsWith('race')){
      fs.openSync=function(path,flags,...args){if(path===file){assert(flags&fs.constants.O_NONBLOCK,'portable open must be nonblocking');assert(flags&fs.constants.O_NOFOLLOW,'portable open must reject symlinks');fs.unlinkSync(file);execFileSync('mkfifo',[file]);}return open(path,flags,...args);};
    }else{fs.unlinkSync(file);execFileSync('mkfifo',[file]);}
    try{await assert.rejects(service.perform({action:sync?'sync-pull':'import'}),/regular JSON file/);}finally{fs.openSync=open;}
    assert.deepEqual(repo.read(),before);assert.equal(fs.readFileSync(repo.file,'utf8'),disk);
    console.log(`PASS ${mode}: FIFO rejected promptly; store unchanged`);
  }else{
    if(process.platform!=='win32')for(const scenario of ['fifo-import','fifo-sync','race-import','race-sync']){
      const result=spawnSync(process.execPath,[process.argv[1],scenario,directory],{timeout:3000,encoding:'utf8'});
      assert.ifError(result.error);assert.equal(result.status,0,result.stderr);process.stdout.write(result.stdout);
    }
    const {repo,file,service}=setup('growth');repo.save(fact);await service.perform({action:'export',ownerLabel:'Device'});
    const before=repo.read(),disk=fs.readFileSync(repo.file,'utf8'),stat=fs.fstatSync,read=fs.readSync,close=fs.closeSync;
    let target,bytes=0,closed=false;
    fs.fstatSync=function(fd,...args){const result=stat(fd,...args);if(target===undefined&&result.ino===fs.statSync(file).ino){target=fd;fs.truncateSync(file,64_000_000);}return result;};
    fs.readSync=function(fd,...args){const n=read(fd,...args);if(fd===target)bytes+=n;return n;};
    fs.closeSync=function(fd){if(fd===target)closed=true;return close(fd);};
    try{await assert.rejects(service.perform({action:'import'}),/exceeds 32 MB/);}finally{fs.fstatSync=stat;fs.readSync=read;fs.closeSync=close;}
    assert.equal(bytes,32_000_001,'read only the allowed bytes and one overflow probe');assert(closed);assert.deepEqual(repo.read(),before);assert.equal(fs.readFileSync(repo.file,'utf8'),disk);
    console.log(`PASS growth after fstat: read ${bytes} bytes from 64 MB file, closed descriptor, unchanged disk/memory`);
  }
}finally{if(!mode)fs.rmSync(directory,{recursive:true,force:true});}
