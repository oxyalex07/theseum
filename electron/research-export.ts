import { spawn } from 'node:child_process';
import { basename, dirname } from 'node:path';

// Node has no openat(2). A dedicated process gives us an OS-pinned cwd without
// changing the Electron main process's global cwd. The child verifies its cwd
// against the native destination receipt BEFORE creating anything, then uses
// only single-component relative paths. Renaming any ancestor cannot redirect
// creation or cleanup. This also works without /proc or /dev/fd dependencies.
const exportWorker=String.raw`
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const input=JSON.parse(fs.readFileSync(0,'utf8'));
const changed=()=>{throw Error('Destination folder changed during export. Choose a destination again.');};
let directory,fd,created,complete=false;
const name='./'+input.name;
function identity(stat){return stat.dev===input.parent.dev&&stat.ino===input.parent.ino;}
function checkParent(){
  const stat=fs.lstatSync(input.directory);
  if(!stat.isDirectory()||stat.isSymbolicLink()||!identity(stat)||fs.realpathSync(input.directory)!==path.resolve(input.directory))changed();
}
try{
  // cwd was pinned by the OS during spawn. Even if that pathname was swapped
  // before spawn, this descriptor check rejects the substituted directory.
  if(process.platform!=='win32')directory=fs.openSync('.',fs.constants.O_RDONLY|(fs.constants.O_DIRECTORY||0)|(fs.constants.O_NOFOLLOW||0)|fs.constants.O_NONBLOCK);
  const parent=directory===undefined?fs.statSync('.'):fs.fstatSync(directory);
  if(!parent.isDirectory()||!identity(parent)||path.basename(input.name)!==input.name||input.name==='.'||input.name==='..')changed();
  checkParent();
  fd=fs.openSync(name,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|(fs.constants.O_NOFOLLOW||0)|fs.constants.O_NONBLOCK,0o600);
  created=fs.fstatSync(fd);
  if(!created.isFile()||created.nlink!==1)throw Error('Unsafe export destination.');
  checkParent();
  // Keep the cwd/cleanup owner alive when a write or fsync stalls. Only the
  // descriptor is handed to the bounded writer; it never receives a pathname.
  const writer=spawnSync(process.execPath,['-e',"const fs=require('node:fs');fs.writeFileSync(3,fs.readFileSync(0));fs.fsyncSync(3);"],{
    input:input.text,encoding:'utf8',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},
    stdio:['pipe','pipe','pipe',fd],windowsHide:true,timeout:10000,killSignal:'SIGKILL',maxBuffer:64*1024,
  });
  if(writer.error)throw Error('Research export write failed: '+writer.error.message);
  if(writer.status!==0)throw Error(writer.stderr.trim()||'Research export write failed.');
  checkParent();
  fs.closeSync(fd);fd=undefined;
  if(process.platform!=='win32')fs.fsyncSync(directory);
  complete=true;
}catch(error){
  process.stderr.write(error&&error.code==='EEXIST'?'Destination already exists. Choose a new filename; research export never overwrites a file.':String(error.message||error));
  process.exitCode=1;
}finally{
  if(fd!==undefined)fs.closeSync(fd);
  if(created&&!complete){
    // Cleanup uses the same pinned cwd, including after parent/ancestor swaps.
    try{const current=fs.lstatSync(name);if(current.dev===created.dev&&current.ino===created.ino)fs.unlinkSync(name);}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  if(directory!==undefined)fs.closeSync(directory);
}
`;

export function exportResearchMarkdown(destination:string,parent:{dev:number;ino:number},text:string):Promise<void> {
  return new Promise((accept,reject)=>{
    const child=spawn(process.execPath,['-e',exportWorker],{
      cwd:dirname(destination),env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},
      stdio:['pipe','ignore','pipe'],windowsHide:true,timeout:15000,killSignal:'SIGKILL',
    });
    let errorText='';
    child.stderr.on('data',(chunk:Buffer)=>{if(errorText.length<64*1024)errorText+=chunk.toString('utf8').slice(0,64*1024-errorText.length);});
    child.on('error',error=>reject(new Error(`Research export failed: ${error.message}`)));
    child.stdin.on('error',()=>{/* Spawn/close reports failure, including a closed input pipe. */});
    child.on('close',(status,signal)=>{if(status===0)accept();else reject(new Error(errorText.trim()||(signal?'Research export interrupted. Check the selected destination before retrying.':'Research export failed.')));});
    child.stdin.end(JSON.stringify({directory:dirname(destination),name:basename(destination),parent,text}));
  });
}
